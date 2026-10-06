import {PriceProvider} from "./client/provider/PriceProvider";
import {ExternalApiError} from "./error/ExternalApiError";
import {Logger} from "./utils/Logger";
import {loadConfig} from "./config/Config";
import {createDb} from "./database/Connection";
import {runMigrations} from "./database/Migration";
import {createApp} from "./App";

// временно ошибка пока нет клиента CoinMarketCap
const notConnectedProvider: PriceProvider = {
  async findCoinBySymbol() {
    throw new ExternalApiError('CoinMarketCap client is not connected yet');
  },
  async getPrices() {
    throw new ExternalApiError('CoinMarketCap client is not connected yet');
  },
};

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

  Logger.info('Starting application', {
    port: config.port,
    dbPath: config.dbPath,
    cmcBaseUrl: config.cmcBaseUrl,
    httpTimeoutMs: config.httpTimeoutMs,
    syncIntervalMs: config.syncIntervalMs,
  });

  const db = createDb(config.dbPath);
  runMigrations(db);
  Logger.info('Database ready');

  const app = createApp({ db, provider: notConnectedProvider });

  app.listen(config.port, () => {
    Logger.info('Server started', { port: config.port });
  });
}

try {
  main();
} catch (error) {
  Logger.error('Failed to start application', error);
  process.exit(1);
}
