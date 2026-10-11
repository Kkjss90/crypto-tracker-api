import {CoinEntity} from "../entity/CoinEntity";
import {Coin} from "../model/Coin";
import {CoinResponse} from "../dto/response/CoinResponse";
import {TimeFormatter} from "../utils/Time";

export function toCoin(entity: CoinEntity): Coin {
  return {
    id: entity.id,
    cmcId: entity.cmc_id,
    symbol: entity.symbol,
    name: entity.name,
    createdAt: new Date(entity.created_at),
    updatedAt: new Date(entity.updated_at),
  };
}

export function toCoinResponse(coin: Coin, formatTime: TimeFormatter): CoinResponse {
  return {
    id: coin.id,
    cmcId: coin.cmcId,
    symbol: coin.symbol,
    name: coin.name,
    createdAt: formatTime(coin.createdAt),
    updatedAt: formatTime(coin.createdAt),
  };
}
