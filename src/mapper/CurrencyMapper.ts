import {CurrencyEntity} from "../entity/CurrencyEntity";
import {Currency, CurrencyPage} from "../model/Currency";
import {CurrencyListResponse, CurrencyResponse} from "../dto/response/CurrencyResponse";
import {TimeFormatter} from "../utils/Time";

export function toCurrency(entity: CurrencyEntity): Currency {
  return {
    cmcId: entity.cmc_id,
    symbol: entity.symbol,
    name: entity.name,
    slug: entity.slug,
    rank: entity.cmc_rank,
  };
}

export function toCurrencyResponse(currency: Currency): CurrencyResponse {
  return {
    cmcId: currency.cmcId,
    symbol: currency.symbol,
    name: currency.name,
    slug: currency.slug,
    rank: currency.rank,
  };
}

export function toCurrencyListResponse(page: CurrencyPage, formatTime: TimeFormatter): CurrencyListResponse {
  return {
    items: page.items.map((item) => toCurrencyResponse(item)),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    syncedAt: page.syncedAt ? formatTime(page.syncedAt) : null,
  };
}
