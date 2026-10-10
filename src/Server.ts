import {Logger} from "./utils/Logger";
import {loadConfig} from "./config/Config";
import {createDb} from "./database/Connection";
import {runMigrations} from "./database/Migration";
import {createApp} from "./App";
import {createAuthService} from "./service/AuthService";
import {CoinMarketCapClient} from "./client/CoinMarketCapClient";
import {PriceSyncJob} from "./job/PriceSyncJob";
import {CoinRepository} from "./repository/CoinRepository";
import {PriceRepository} from "./repository/PriceRepository";
import {createShutdown} from "./Shutdown";

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

  const provider = new CoinMarketCapClient({
    baseUrl: config.cmcBaseUrl,
    apiKey: config.cmcApiKey,
    timeoutMs: config.httpTimeoutMs,
  });

  Logger.info('Starting application', {
    port: config.port,
    dbPath: config.dbPath,
    cmcBaseUrl: config.cmcBaseUrl,
    httpTimeoutMs: config.httpTimeoutMs,
    syncIntervalMs: config.syncIntervalMs,
    shutdownTimeoutMs: config.shutdownTimeoutMs,
  });

  const db = createDb(config.dbPath);
  runMigrations(db);
  createAuthService(db, config.bootstrapApiKeyTtlDays).ensureBootstrapKey(config.bootstrapApiKey);

  Logger.info('Database ready');

  const app = createApp({db, provider: provider, apiKeyTtlDays: config.bootstrapApiKeyTtlDays});

  const job = new PriceSyncJob({
    coins: new CoinRepository(db),
    prices: new PriceRepository(db),
    provider,
    intervalMs: config.syncIntervalMs,
  });

  const server = app.listen(config.port, (error?: Error) => {
    if (error) {
      Logger.error('Failed to start the HTTP server', error);
      process.exit(1);
    }
    Logger.info('Server started', {port: config.port});
    job.start();
  });

  const shutdown = createShutdown({job, server, db, timeoutMs: config.shutdownTimeoutMs});
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

try {
  main();
} catch (error) {
  Logger.error('Failed to start application', error);
  process.exit(1);
}
