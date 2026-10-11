import {CurrenciesRepository} from "../repository/CurrenciesRepository";
import {CurrencyCatalogProvider} from "../client/provider/PriceProvider";
import {PeriodicTask} from "./PeriodicTask";
import {Logger} from "../utils/Logger";
import {AppError} from "../error/AppError";

export interface CurrencySyncOptions {
  currencies: CurrenciesRepository;
  provider: CurrencyCatalogProvider;
  intervalMs: number;
}

export interface CurrencySyncResult {
  synced: number;
  skipped: boolean;
}

export class CurrencySyncJob {
  private readonly task: PeriodicTask;

  constructor(private readonly options: CurrencySyncOptions) {
    this.task = new PeriodicTask({
      name: 'currency-sync',
      intervalMs: options.intervalMs,
      run: () => this.syncIfStale(),
      onError: (error) => this.logFailure(error),
    });
  }

  start(): void {
    this.task.start();
  }

  stop(): Promise<void> {
    return this.task.stop();
  }

  async syncIfStale(): Promise<CurrencySyncResult> {
    const lastSyncedAt = this.options.currencies.lastSyncedAt();
    const freshForMs = Math.floor(this.options.intervalMs * 0.9);

    if (lastSyncedAt && Date.now() - lastSyncedAt.getTime() < freshForMs) {
      Logger.debug('Currency catalog is fresh, skipping', { syncedAt: lastSyncedAt.toISOString() });
      return { synced: 0, skipped: true };
    }
    return this.runOnce();
  }

  async runOnce(): Promise<CurrencySyncResult> {
    const startedAt = Date.now();
    const items = await this.options.provider.listCurrencies();

    if (items.length === 0) {
      Logger.warn('Provider returned an empty currency list, keeping the existing catalog');
      return { synced: 0, skipped: false };
    }

    const synced = this.options.currencies.replaceAll(items, new Date());
    Logger.info('Currency catalog synced', { synced, durationMs: Date.now() - startedAt });
    return { synced, skipped: false };
  }

  private logFailure(error: unknown): void {
    if (error instanceof AppError) {
      Logger.warn('Currency sync failed: provider error', {
        code: error.code,
        status: error.statusCode,
        message: error.message,
      });
    } else {
      Logger.error('Currency sync failed unexpectedly', error);
    }
  }
}
