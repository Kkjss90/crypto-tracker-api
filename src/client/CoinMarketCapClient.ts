import axios, {HttpStatusCode} from 'axios';
import type {AxiosInstance} from 'axios';
import {CoinInfo, CurrencyCatalogProvider, PriceProvider} from "./provider/PriceProvider";
import {Logger} from "../utils/Logger";
import {ExternalApiError} from "../error/ExternalApiError";
import {Currency} from "../model/Currency";

const MAP_PATH = '/v1/cryptocurrency/map';
const QUOTES_PATH = '/v2/cryptocurrency/quotes/latest';
const QUOTE_CURRENCY = 'USD';
const QUOTES_BATCH_SIZE = 100;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAP_PAGE_SIZE = 5000;
const MAX_MAP_PAGES = 20;

export interface CoinMarketCapOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

interface CmcResponse {
  httpStatus: number;
  errorCode: number;
  message?: string;
  credits?: number;
  data: unknown;
}

interface MapEntry {
  id: number;
  symbol: string;
  name: string;
  slug: string;
  rank: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMapEntries(data: unknown): MapEntry[] {
  if (!Array.isArray(data)) return [];

  const entries: MapEntry[] = [];
  for (const item of data) {
    if (isRecord(item) && typeof item.id === 'number' && typeof item.symbol === 'string' && typeof item.name === 'string') {
      entries.push({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        slug: typeof item.slug === 'string' ? item.slug : '',
        rank: typeof item.rank === 'number' ? item.rank : null,
      });
    }
  }
  return entries;
}

function extractUsdPrice(entry: unknown): number | undefined {
  const item = Array.isArray(entry) ? entry[0] : entry;
  if (!isRecord(item) || !isRecord(item.quote)) return undefined;

  const usd = item.quote[QUOTE_CURRENCY];
  if (!isRecord(usd)) return undefined;

  const price = usd.price;
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : undefined;
}

function compareByRank(a: MapEntry, b: MapEntry): number {
  const rankA = a.rank ?? Number.POSITIVE_INFINITY;
  const rankB = b.rank ?? Number.POSITIVE_INFINITY;
  return rankA === rankB ? a.id - b.id : rankA - rankB;
}

export class CoinMarketCapClient implements PriceProvider, CurrencyCatalogProvider {
  private readonly http: AxiosInstance;
  private readonly timeoutMs: number;

  constructor(options: CoinMarketCapOptions) {
    this.timeoutMs = options.timeoutMs;
    this.http = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs,
      headers: {'X-CMC_PRO_API_KEY': options.apiKey, Accept: 'application/json'},
      validateStatus: () => true,
      maxRedirects: 0,
      maxContentLength: MAX_RESPONSE_BYTES,
    });
  }

  async findCoinBySymbol(symbol: string): Promise<CoinInfo | null> {
    const response = await this.request(MAP_PATH, {symbol});

    if (response.httpStatus === HttpStatusCode.BadRequest) {
      Logger.info('CoinMarketCap does not know this symbol', {symbol});
      return null;
    }
    this.assertSuccess(response, MAP_PATH);

    const candidates = parseMapEntries(response.data).filter((entry) => entry.symbol.toUpperCase() === symbol);
    if (candidates.length === 0) return null;

    const best = [...candidates].sort(compareByRank)[0];
    return {cmcId: best.id, symbol: best.symbol.toUpperCase(), name: best.name};
  }

  async getPrices(cmcIds: number[]): Promise<Map<number, number>> {
    const prices = new Map<number, number>();

    for (let start = 0; start < cmcIds.length; start += QUOTES_BATCH_SIZE) {
      const batch = cmcIds.slice(start, start + QUOTES_BATCH_SIZE);
      const response = await this.request(QUOTES_PATH, {
        id: batch.join(','),
        convert: QUOTE_CURRENCY,
        skip_invalid: 'true',
      });
      this.assertSuccess(response, QUOTES_PATH);

      const data = response.data;
      if (!isRecord(data)) {
        if (Array.isArray(data) && data.length === 0) continue;
        throw this.unexpectedResponse(QUOTES_PATH);
      }

      for (const id of batch) {
        const price = extractUsdPrice(data[String(id)]);
        if (price !== undefined) prices.set(id, price);
      }
    }

    return prices;
  }

  private async request(path: string, params: Record<string, string>): Promise<CmcResponse> {
    const startedAt = Date.now();

    let response;
    try {
      response = await this.http.get<unknown>(path, {params});
    } catch (error) {
      throw this.transportError(error, path);
    }

    const body = isRecord(response.data) ? response.data : {};
    const status = isRecord(body.status) ? body.status : {};
    const rawCode = status.error_code;

    const result: CmcResponse = {
      httpStatus: response.status,
      errorCode: rawCode === undefined || rawCode === null ? 0 : Number(rawCode),
      message: typeof status.error_message === 'string' ? status.error_message : undefined,
      credits: typeof status.credit_count === 'number' ? status.credit_count : undefined,
      data: body.data,
    };

    Logger.debug('CoinMarketCap response', {
      path,
      httpStatus: result.httpStatus,
      credits: result.credits,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }

  private assertSuccess(response: CmcResponse, path: string): void {
    const httpOk = response.httpStatus >= 200 && response.httpStatus < 300;
    if (httpOk && response.errorCode === 0) return;

    const meta = {path, httpStatus: response.httpStatus, errorCode: response.errorCode, message: response.message};

    if (response.httpStatus === HttpStatusCode.Unauthorized || response.httpStatus === HttpStatusCode.Forbidden) {
      Logger.error('CoinMarketCap rejected the API key or the plan does not allow this endpoint', meta);
      throw new ExternalApiError('Price provider rejected the request');
    }
    if (response.httpStatus === HttpStatusCode.TooManyRequests) {
      Logger.warn('CoinMarketCap rate limit exceeded', meta);
      throw new ExternalApiError('Price provider rate limit exceeded');
    }

    Logger.error('CoinMarketCap returned an error', meta);
    throw new ExternalApiError('Price provider returned an error');
  }

  private transportError(error: unknown, path: string): ExternalApiError {
    const code = axios.isAxiosError(error) ? error.code : undefined;

    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      Logger.warn('CoinMarketCap request timed out', {path, timeoutMs: this.timeoutMs});
      return new ExternalApiError('Price provider timed out', HttpStatusCode.GatewayTimeout);
    }

    Logger.warn('CoinMarketCap request failed', {path, code});
    return new ExternalApiError('Price provider is unreachable');
  }

  private unexpectedResponse(path: string): ExternalApiError {
    Logger.error('CoinMarketCap returned an unexpected response', {path});
    return new ExternalApiError('Price provider returned an unexpected response');
  }

  async listCurrencies(): Promise<Currency[]> {
    const byId = new Map<number, Currency>();

    for (let page = 0; page < MAX_MAP_PAGES; page += 1) {
      const response = await this.request(MAP_PATH, {
        listing_status: 'active',
        sort: 'cmc_rank',
        start: String(page * MAP_PAGE_SIZE + 1),
        limit: String(MAP_PAGE_SIZE),
      });
      this.assertSuccess(response, MAP_PATH);

      if (!Array.isArray(response.data)) {
        throw this.unexpectedResponse(MAP_PATH);
      }

      for (const entry of parseMapEntries(response.data)) {
        byId.set(entry.id, {
          cmcId: entry.id,
          symbol: entry.symbol.toUpperCase(),
          name: entry.name,
          slug: entry.slug,
          rank: entry.rank,
        });
      }

      if (response.data.length < MAP_PAGE_SIZE) break;
    }

    return [...byId.values()];
  }
}
