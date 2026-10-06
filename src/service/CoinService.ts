import {CoinsRepository} from "../repository/CoinsRepository";
import {PriceProvider} from "../client/provider/PriceProvider";
import {ConflictError} from "../error/ConflictError";
import {NotFoundError} from "../error/NotFoundError";
import {Logger} from "../utils/Logger";
import {isUniqueConstraintError} from "../utils/UniqConstriantValidation";
import {Coin} from "../model/Coin";

export class CoinsService {
  constructor(
    private readonly coins: CoinsRepository,
    private readonly provider: PriceProvider,
  ) {}

  async add(symbol: string): Promise<Coin> {
    if (this.coins.findBySymbol(symbol)) {
      throw new ConflictError(`Coin ${symbol} is already tracked`);
    }

    const info = await this.provider.findCoinBySymbol(symbol);
    if (!info) {
      throw new NotFoundError(`Coin ${symbol} not found on CoinMarketCap`);
    }

    if (this.coins.findByCmcId(info.cmcId)) {
      throw new ConflictError(`Coin ${info.symbol} is already tracked`);
    }

    try {
      const coin = this.coins.create({ cmcId: info.cmcId, symbol: info.symbol, name: info.name });
      Logger.info('Coin added', { coinId: coin.id, symbol: coin.symbol });
      return coin;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(`Coin ${info.symbol} is already tracked`);
      }
      throw error;
    }
  }

  list(): Coin[] {
    return this.coins.findAll();
  }

  get(id: number): Coin {
    const coin = this.coins.findById(id);
    if (!coin) {
      throw new NotFoundError(`Coin ${id} not found`);
    }
    return coin;
  }

  rename(id: number, name: string): Coin {
    const coin = this.coins.updateName(id, name);
    if (!coin) {
      throw new NotFoundError(`Coin ${id} not found`);
    }
    Logger.info('Coin renamed', { coinId: id });
    return coin;
  }

  remove(id: number): void {
    if (!this.coins.delete(id)) {
      throw new NotFoundError(`Coin ${id} not found`);
    }
    Logger.info('Coin removed', { coinId: id });
  }
}
