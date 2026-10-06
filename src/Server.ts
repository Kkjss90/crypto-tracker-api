import {createApp} from './App';
import {loadConfig} from "./config/Config";
import {Logger} from "./utils/Logger";
import {createDb} from "./database/Connection";
import {runMigrations} from "./database/Migration";

function main(): void {
  const config = loadConfig();

  const db = createDb(config.dbPath);
  runMigrations(db);
  Logger.info('Database ready', { path: config.dbPath });

  const app = createApp();

  app.listen(config.port, () => {
    Logger.info('Server started', { port: config.port });
  });
}

try {
  main();
} catch (error) {
  Logger.error('Failed to start application:', error instanceof Error ? error.message : error);
  process.exit(1);
}
