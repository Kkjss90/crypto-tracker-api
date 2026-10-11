import {PriceHistoryEntity} from "../entity/PriceHistoryEntity";
import {CurrentPrice, HistoryPage, PRICE_CURRENCY, PricePoint} from "../model/PricePoint";
import {PricePointResponse} from "../dto/response/PricePointResponse";
import {PriceResponse} from "../dto/response/PriceResponse";
import {HistoryResponse} from "../dto/response/HistoryResponse";
import {Coin} from "../model/Coin";
import {TimeFormatter} from "../utils/Time";

export function toPricePoint(entity: PriceHistoryEntity): PricePoint {
  return {
    id: entity.id,
    coinId: entity.coin_id,
    price: entity.price,
    fetchedAt: new Date(entity.fetched_at),
  };
}

export function toPricePointResponse(point: PricePoint, formatTime: TimeFormatter): PricePointResponse {
  return { price: point.price, fetchedAt: formatTime(point.fetchedAt), };
}

export function toPriceResponse(current: CurrentPrice, formatTime: TimeFormatter): PriceResponse {
  return {
    coinId: current.coin.id,
    symbol: current.coin.symbol,
    currency: PRICE_CURRENCY,
    price: current.price,
    fetchedAt: formatTime(current.fetchedAt),
    recorded: current.recorded,
  };
}

export function toHistoryResponse(coin: Coin, page: HistoryPage, formatTime: TimeFormatter): HistoryResponse {
  return {
    coinId: coin.id,
    symbol: coin.symbol,
    currency: PRICE_CURRENCY,
    items: page.items.map((point) => toPricePointResponse(point, formatTime)),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
  };
}
