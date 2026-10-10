import type {Server} from 'node:http';
import {Db} from "./database/Connection";
import {Logger} from "./utils/Logger";

export interface Stoppable {
  stop(): Promise<void>;
}

export interface ShutdownOptions {
  job: Stoppable;
  server: Server;
  db: Db;
  timeoutMs: number;
  exit?: (code: number) => void;
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function createShutdown(options: ShutdownOptions): (signal: string) => Promise<void> {
  const exit = options.exit ?? ((code: number): void => process.exit(code));
  let inProgress: Promise<void> | undefined;

  const run = async (signal: string): Promise<void> => {
    Logger.info('Shutting down', {signal});

    const forceTimer = setTimeout(() => {
      Logger.error('Graceful shutdown timed out, forcing exit', {timeoutMs: options.timeoutMs});
      options.server.closeAllConnections();
      exit(1);
    }, options.timeoutMs);

    let failed = false;

    const steps = await Promise.allSettled([options.job.stop(), closeServer(options.server)]);
    for (const step of steps) {
      if (step.status === 'rejected') {
        failed = true;
        Logger.error('Shutdown step failed', step.reason);
      }
    }

    try {
      options.db.close();
      Logger.info('Database closed');
    } catch (error) {
      failed = true;
      Logger.error('Failed to close the database', error);
    }

    clearTimeout(forceTimer);
    Logger.info('Shutdown complete', {signal});
    exit(failed ? 1 : 0);
  };

  return (signal) => {
    if (inProgress) {
      Logger.info('Shutdown already in progress', {signal});
      return inProgress;
    }
    inProgress = run(signal);
    return inProgress;
  };
}
