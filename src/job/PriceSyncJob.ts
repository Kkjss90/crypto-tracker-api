import {CoinRepository} from "../repository/CoinRepository";
import {PriceRepository} from "../repository/PriceRepository";
import {PriceProvider} from "../client/provider/PriceProvider";
import {NewPricePoint} from "../model/PricePoint";
import {Logger} from "../utils/Logger";
import {AppError} from "../error/AppError";
import {PeriodicTask} from "./PeriodicTask";

export interface PriceSyncOptions {
  coins: CoinRepository;
  prices: PriceRepository;
  provider: PriceProvider;
  intervalMs: number;
}

export interface SyncResult {
  tracked: number;
  saved: number;
  unchanged: number;
}

export class PriceSyncJob {
  private readonly task: PeriodicTask;

  constructor(private readonly options: PriceSyncOptions) {
    this.task = new PeriodicTask({
      name: 'price-sync',
      intervalMs: options.intervalMs,
      run: () => this.runOnce(),
      onError: (error) => this.logFailure(error),
    });
  }

  start(): void {
    this.task.start();
  }

  stop(): Promise<void> {
    return this.task.stop();
  }

  async runOnce(): Promise<SyncResult> {
    const startedAt = Date.now();

    const tracked = this.options.coins.findAll();
    if (tracked.length === 0) {
      Logger.debug('Price sync skipped: no tracked coins');
      return {tracked: 0, saved: 0, unchanged: 0};
    }

    const fetched = await this.options.provider.getPrices(tracked.map((coin) => coin.cmcId));

    const fetchedAt = new Date();
    const current = this.options.coins.findAll();
    const points = current.flatMap((coin): NewPricePoint[] => {
      const price = fetched.get(coin.cmcId);
      return price === undefined ? [] : [{coinId: coin.id, price, fetchedAt}];
    });

    const saved = this.options.prices.saveChanged(points);
    const result: SyncResult = {tracked: current.length, saved, unchanged: points.length - saved};
    Logger.info('Price sync completed', {
      ...result,
      missing: current.length - saved,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }

  private logFailure(error: unknown): void {
    if (error instanceof AppError) {
      Logger.warn('Price sync failed: provider error', {
        code: error.code,
        status: error.statusCode,
        message: error.message,
      });
    } else {
      Logger.error('Price sync failed unexpectedly', error);
    }
  }
}
