import {Logger} from "./utils/Logger";
import {loadConfig} from "./config/Config";
import {createDb} from "./database/Connection";
import {runMigrations} from "./database/Migration";
import {createApp} from "./App";
import {createAuthService} from "./service/AuthService";
import {CoinMarketCapClient} from "./client/CoinMarketCapClient";
import {PriceSyncJob} from "./job/PriceSyncJob";
import {createShutdown} from "./Shutdown";
import {createTimeFormatter} from "./utils/Time";
import {CurrencySyncJob} from "./job/CurrencySyncJob";
import {CurrenciesRepository} from "./repository/CurrenciesRepository";
import {CoinRepository} from "./repository/CoinRepository";
import {PriceRepository} from "./repository/PriceRepository";

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled promise rejection', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception', error);
  process.exit(1);
});

function main(): void {
  const config = loadConfig();
  Logger.setTimeFormatter(createTimeFormatter(config.timeZone));

  Logger.info('Starting application', {
    port: config.port,
    dbPath: config.dbPath,
    cmcBaseUrl: config.cmcBaseUrl,
    httpTimeoutMs: config.httpTimeoutMs,
    syncIntervalMs: config.syncIntervalMs,
    currencySyncIntervalMs: config.currencySyncIntervalMs,
    shutdownTimeoutMs: config.shutdownTimeoutMs,
    timeZone: config.timeZone,
  });

  const db = createDb(config.dbPath);
  runMigrations(db);
  createAuthService(db, config.bootstrapApiKeyTtlDays).ensureBootstrapKey(config.bootstrapApiKey);

  Logger.info('Database ready');

  const provider = new CoinMarketCapClient({
    baseUrl: config.cmcBaseUrl,
    apiKey: config.cmcApiKey,
    timeoutMs: config.httpTimeoutMs,
  });

  const app = createApp({
    db,
    provider,
    apiKeyTtlDays: config.bootstrapApiKeyTtlDays,
    timeZone: config.timeZone,
  });

  const priceJob = new PriceSyncJob({
    coins: new CoinRepository(db),
    prices: new PriceRepository(db),
    provider,
    intervalMs: config.syncIntervalMs,
  });

  const currencyJob = new CurrencySyncJob({
    currencies: new CurrenciesRepository(db),
    provider,
    intervalMs: config.currencySyncIntervalMs,
  });

  const jobs = {
    stop: async (): Promise<void> => {
      await Promise.all([priceJob.stop(), currencyJob.stop()]);
    },
  };

  const server = app.listen(config.port, (error?: Error) => {
    if (error) {
      Logger.error('Failed to start the HTTP server', error);
      process.exit(1);
    }
    Logger.info('Server started', {port: config.port});
    priceJob.start();
    currencyJob.start();
  });

  const shutdown = createShutdown({job: jobs, server, db, timeoutMs: config.shutdownTimeoutMs});
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

try {
  main();
} catch (error) {
  Logger.error('Failed to start application', error);
  process.exit(1);
}
