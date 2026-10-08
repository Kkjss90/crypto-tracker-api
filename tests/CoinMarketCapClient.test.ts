import {FakeCmcServer, startFakeCmcServer} from "./utils/fakeCmcServer";
import {CoinMarketCapClient} from "../src/client/CoinMarketCapClient";
import {Logger} from "../src/utils/Logger";
import {ExternalApiError} from "../src/error/ExternalApiError";

const API_KEY = 'secret-cmc-key-0123456789';

const ok = (data: unknown, errorCode: unknown = 0) => ({
  status: 200,
  body: {data, status: {error_code: errorCode, error_message: null, credit_count: 1}},
});

const quote = (id: number, price: number | null) => ({
  id,
  symbol: `C${id}`,
  quote: {USD: {price}},
});

describe('CoinMarketCapClient', () => {
  let server: FakeCmcServer;
  let client: CoinMarketCapClient;

  beforeEach(async () => {
    server = await startFakeCmcServer();
    client = new CoinMarketCapClient({baseUrl: server.baseUrl, apiKey: API_KEY, timeoutMs: 200});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await server.close();
  });

  describe('findCoinBySymbol', () => {
    it('находит монету и передаёт ключ в заголовке', async () => {
      server.respondWith(() => ok([{id: 1, rank: 1, name: 'Bitcoin', symbol: 'BTC'}]));

      const coin = await client.findCoinBySymbol('BTC');

      expect(coin).toEqual({cmcId: 1, symbol: 'BTC', name: 'Bitcoin'});
      expect(server.requests[0].apiKey).toBe(API_KEY);
      expect(server.requests[0].url).toContain('symbol=BTC');
    });

    it('из нескольких монет с одним тикером берёт ту, что выше в рейтинге', async () => {
      server.respondWith(() =>
        ok([
          {id: 900, rank: null, name: 'Unranked BTC', symbol: 'BTC'},
          {id: 5, rank: 40, name: 'Second BTC', symbol: 'BTC'},
          {id: 1, rank: 1, name: 'Bitcoin', symbol: 'BTC'},
        ]),
      );

      const coin = await client.findCoinBySymbol('BTC');

      expect(coin?.cmcId).toBe(1);
    });

    it('возвращает null при пустом ответе', async () => {
      server.respondWith(() => ok([]));

      expect(await client.findCoinBySymbol('NOPE')).toBeNull();
    });

    it('возвращает null, если CMC отвечает 400 на неизвестный тикер', async () => {
      server.respondWith(() => ({
        status: 400,
        body: {data: null, status: {error_code: 400, error_message: 'Invalid value for "symbol"'}},
      }));

      expect(await client.findCoinBySymbol('NOPE')).toBeNull();
    });

    it('игнорирует записи с другим тикером', async () => {
      server.respondWith(() => ok([{id: 2, rank: 2, name: 'Other', symbol: 'OTH'}]));

      expect(await client.findCoinBySymbol('BTC')).toBeNull();
    });
  });

  describe('getPrices', () => {
    it('возвращает цены по id и запрашивает нужные параметры', async () => {
      server.respondWith(() => ok({'1': quote(1, 43250.5), '1027': quote(1027, 2500.25)}));

      const prices = await client.getPrices([1, 1027]);

      expect(prices.get(1)).toBe(43250.5);
      expect(prices.get(1027)).toBe(2500.25);
      const url = new URL(server.requests[0].url, 'http://localhost');
      expect(url.searchParams.get('id')).toBe('1,1027');
      expect(url.searchParams.get('convert')).toBe('USD');
      expect(url.searchParams.get('skip_invalid')).toBe('true');
    });

    it('пропускает отсутствующие, нулевые и пустые цены', async () => {
      server.respondWith(() => ok({'1': quote(1, 100), '2': quote(2, null), '3': quote(3, 0)}));

      const prices = await client.getPrices([1, 2, 3, 4]);

      expect([...prices.keys()]).toEqual([1]);
    });

    it('не делает запрос для пустого списка', async () => {
      const prices = await client.getPrices([]);

      expect(prices.size).toBe(0);
      expect(server.requests).toHaveLength(0);
    });

    it('делит большой список на пачки по 100', async () => {
      server.respondWith((url) => {
        const ids = (url.searchParams.get('id') ?? '').split(',').map(Number);
        return ok(Object.fromEntries(ids.map((id) => [String(id), quote(id, id + 0.5)])));
      });
      const ids = Array.from({length: 150}, (_, index) => index + 1);

      const prices = await client.getPrices(ids);

      expect(server.requests).toHaveLength(2);
      expect(prices.size).toBe(150);
    });

    it('принимает error_code строкой "0" и null', async () => {
      server.respondWith(() => ok({'1': quote(1, 10)}, '0'));
      expect((await client.getPrices([1])).get(1)).toBe(10);

      server.respondWith(() => ok({'1': quote(1, 11)}, null));
      expect((await client.getPrices([1])).get(1)).toBe(11);
    });
  });

  describe('обработка ошибок', () => {
    beforeEach(() => {
      jest.spyOn(Logger, 'warn').mockImplementation(() => {
      });
      jest.spyOn(Logger, 'error').mockImplementation(() => {
      });
    });

    const expectProviderError = (promise: Promise<unknown>, statusCode: number) =>
      expect(promise).rejects.toMatchObject({statusCode, code: 'EXTERNAL_API_ERROR'});

    it.each([401, 403, 429, 500, 503])('HTTP %i превращается в 502', async (status) => {
      server.respondWith(() => ({
        status,
        body: {data: null, status: {error_code: status, error_message: 'nope'}},
      }));

      await expectProviderError(client.getPrices([1]), 502);
    });

    it('ошибка в теле при HTTP 200 превращается в 502', async () => {
      server.respondWith(() => ok(null, 1008));

      await expectProviderError(client.getPrices([1]), 502);
    });

    it('мусорный ответ превращается в 502', async () => {
      server.respondWith(() => ({status: 200, rawBody: '<html>gateway</html>'}));

      await expectProviderError(client.getPrices([1]), 502);
    });

    it('неожиданная форма данных превращается в 502', async () => {
      server.respondWith(() => ok('oops'));

      await expectProviderError(client.getPrices([1]), 502);
    });

    it('таймаут превращается в 504', async () => {
      server.respondWith(() => ({...ok({'1': quote(1, 1)}), delayMs: 500}));

      await expectProviderError(client.getPrices([1]), 504);
    });

    it('недоступный сервер превращается в 502', async () => {
      const dead = await startFakeCmcServer();
      const deadUrl = dead.baseUrl;
      await dead.close();
      const offline = new CoinMarketCapClient({baseUrl: deadUrl, apiKey: API_KEY, timeoutMs: 200});

      await expectProviderError(offline.getPrices([1]), 502);
      await expectProviderError(offline.findCoinBySymbol('BTC'), 502);
    });

    it('429 логируется как предупреждение о лимите', async () => {
      server.respondWith(() => ({status: 429, body: {data: null, status: {error_code: 429}}}));

      await client.getPrices([1]).catch(() => undefined);

      expect(Logger.warn).toHaveBeenCalledWith(
        'CoinMarketCap rate limit exceeded',
        expect.objectContaining({httpStatus: 429}),
      );
    });

    it('ключ CoinMarketCap не попадает ни в ошибку, ни в логи', async () => {
      server.respondWith(() => ({status: 401, body: {data: null, status: {error_code: 1002}}}));

      let caught: unknown;
      try {
        await client.getPrices([1]);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ExternalApiError);
      const dump = JSON.stringify([
        (caught as Error).message,
        (caught as Error).stack,
        (Logger.warn as jest.Mock).mock.calls,
        (Logger.error as jest.Mock).mock.calls,
      ]);
      expect(dump).not.toContain(API_KEY);
    });
  });
});
