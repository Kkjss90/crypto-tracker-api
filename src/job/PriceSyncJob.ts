import {CoinRepository} from "../repository/CoinRepository";
import {PriceRepository} from "../repository/PriceRepository";
import {PriceProvider} from "../client/provider/PriceProvider";
import {NewPricePoint} from "../model/PricePoint";
import {Logger} from "../utils/Logger";
import {AppError} from "../error/AppError";

export interface PriceSyncOptions {
  coins: CoinRepository;
  prices: PriceRepository;
  provider: PriceProvider;
  intervalMs: number;
}

export interface SyncResult {
  tracked: number;
  saved: number;
}

export class PriceSyncJob {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private started = false;
  private stopRequested = false;
  private stopPromise: Promise<void> | null = null;

  constructor(private readonly options: PriceSyncOptions) {}

  start(): void {
    if (this.started || this.stopRequested) {
      Logger.warn('Price sync job was already started or stopped, ignoring start()');
      return;
    }
    this.started = true;
    Logger.info('Price sync job started', { intervalMs: this.options.intervalMs });
    this.schedule(0);
  }

  stop(): Promise<void> {
    this.stopRequested = true;
    this.stopPromise ??= this.drain();
    return this.stopPromise;
  }

  async runOnce(): Promise<SyncResult> {
    const startedAt = Date.now();

    const tracked = this.options.coins.findAll();
    if (tracked.length === 0) {
      Logger.debug('Price sync skipped: no tracked coins');
      return { tracked: 0, saved: 0 };
    }

    const fetched = await this.options.provider.getPrices(tracked.map((coin) => coin.cmcId));

    const fetchedAt = new Date();
    const current = this.options.coins.findAll();
    const points = current.flatMap((coin): NewPricePoint[] => {
      const price = fetched.get(coin.cmcId);
      return price === undefined ? [] : [{ coinId: coin.id, price, fetchedAt }];
    });

    const saved = this.options.prices.createMany(points);
    Logger.info('Price sync completed', {
      tracked: current.length,
      saved,
      missing: current.length - saved,
      durationMs: Date.now() - startedAt,
    });
    return { tracked: current.length, saved };
  }

  private schedule(delayMs: number): void {
    if (this.stopRequested) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      this.running = this.tick().finally(() => {
        this.running = null;
        this.schedule(this.options.intervalMs);
      });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    try {
      await this.runOnce();
    } catch (error) {
      this.logFailure(error);
    }
  }

  private async drain(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.running;
    Logger.info('Price sync job stopped');
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
