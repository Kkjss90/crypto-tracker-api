import {Coin} from "../model/Coin";
import {CurrentPrice, HistoryPage, HistoryQuery} from "../model/PricePoint";
import {CoinRepository} from "../repository/CoinRepository";
import {PriceRepository} from "../repository/PriceRepository";
import {PriceProvider} from "../client/provider/PriceProvider";
import {Logger} from "../utils/Logger";
import {ExternalApiError} from "../error/ExternalApiError";
import {NotFoundError} from "../error/NotFoundError";

export interface HistoryResult {
  coin: Coin;
  page: HistoryPage;
}

export class PriceService {
  constructor(
    private readonly coins: CoinRepository,
    private readonly prices: PriceRepository,
    private readonly provider: PriceProvider,
  ) {
  }

  async fetchCurrent(coinId: number): Promise<CurrentPrice> {
    const coin = this.requireCoin(coinId);

    const fetched = await this.provider.getPrices([coin.cmcId]);
    const price = fetched.get(coin.cmcId);
    if (price === undefined) {
      Logger.warn('Provider returned no price for a tracked coin', { coinId, cmcId: coin.cmcId });
      throw new ExternalApiError('Price is not available for this coin');
    }

    const current = this.requireCoin(coinId);
    const fetchedAt = new Date();
    const saved = this.prices.saveChanged([{ coinId: current.id, price, fetchedAt }]);

    Logger.debug('Price checked', { coinId, recorded: saved > 0 });
    return { coin: current, price, fetchedAt, recorded: saved > 0 };
  }

  history(coinId: number, query: HistoryQuery): HistoryResult {
    const coin = this.requireCoin(coinId);
    const {items, total} = this.prices.findPage(coinId, query);

    return {coin, page: {items, total, limit: query.limit, offset: query.offset}};
  }

  private requireCoin(coinId: number): Coin {
    const coin = this.coins.findById(coinId);
    if (!coin) {
      throw new NotFoundError(`Coin ${coinId} not found`);
    }
    return coin;
  }
}
