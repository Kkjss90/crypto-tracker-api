import {PriceHistoryEntity} from "../entity/PriceHistoryEntity";
import {HistoryPage, PRICE_CURRENCY, PricePoint} from "../model/PricePoint";
import {PricePointResponse} from "../dto/response/PricePointResponse";
import {PriceResponse} from "../dto/response/PriceResponse";
import {HistoryResponse} from "../dto/response/HistoryResponse";
import {Coin} from "../model/Coin";

export function toPricePoint(entity: PriceHistoryEntity): PricePoint {
  return {
    id: entity.id,
    coinId: entity.coin_id,
    price: entity.price,
    fetchedAt: new Date(entity.fetched_at),
  };
}

export function toPricePointResponse(point: PricePoint): PricePointResponse {
  return {price: point.price, fetchedAt: point.fetchedAt.toISOString()};
}

export function toPriceResponse(coin: Coin, point: PricePoint): PriceResponse {
  return {
    coinId: coin.id,
    symbol: coin.symbol,
    currency: PRICE_CURRENCY,
    ...toPricePointResponse(point),
  };
}

export function toHistoryResponse(coin: Coin, page: HistoryPage): HistoryResponse {
  return {
    coinId: coin.id,
    symbol: coin.symbol,
    currency: PRICE_CURRENCY,
    items: page.items.map((point) => toPricePointResponse(point)),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
  };
}
