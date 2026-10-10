import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {createTestDb, TestDb} from "./utils/TestDb";
import {Logger} from "../src/utils/Logger";
import {createShutdown} from "../src/Shutdown";


const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function get(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get({host: '127.0.0.1', port, agent: false}, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return {promise, resolve};
}

describe('graceful shutdown', () => {
  let testDb: TestDb;
  let server: http.Server;
  let port: number;
  let exit: jest.Mock;

  const dbIsClosed = () => {
    try {
      testDb.db.prepare('SELECT 1').get();
      return false;
    } catch {
      return true;
    }
  };

  beforeEach(async () => {
    testDb = createTestDb();
    server = http.createServer((_req, res) => {
      setTimeout(() => res.end('done'), 100);
    });
    port = await listen(server);
    exit = jest.fn();

    jest.spyOn(Logger, 'info').mockImplementation(() => {
    });
    jest.spyOn(Logger, 'error').mockImplementation(() => {
    });
  });

  afterEach(() => {
    server.closeAllConnections();
    if (server.listening) server.close();
    testDb.cleanup();
    jest.restoreAllMocks();
  });

  it('останавливает задачу, закрывает сервер и БД и выходит с кодом 0', async () => {
    const job = {stop: jest.fn().mockResolvedValue(undefined)};
    const shutdown = createShutdown({job, server, db: testDb.db, timeoutMs: 1000, exit});

    await shutdown('SIGTERM');

    expect(job.stop).toHaveBeenCalledTimes(1);
    expect(server.listening).toBe(false);
    expect(dbIsClosed()).toBe(true);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('повторный сигнал не запускает остановку второй раз', async () => {
    const job = {stop: jest.fn().mockResolvedValue(undefined)};
    const shutdown = createShutdown({job, server, db: testDb.db, timeoutMs: 1000, exit});

    await Promise.all([shutdown('SIGINT'), shutdown('SIGTERM')]);

    expect(job.stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('дожидается активного запроса и текущей итерации задачи', async () => {
    const jobDone = deferred();
    const job = {stop: jest.fn(() => jobDone.promise)};
    const shutdown = createShutdown({job, server, db: testDb.db, timeoutMs: 2000, exit});

    const response = get(port);
    await sleep(20);
    const finished = shutdown('SIGTERM');

    expect(await response).toBe('done');
    expect(exit).not.toHaveBeenCalled();
    expect(dbIsClosed()).toBe(false);

    jobDone.resolve();
    await finished;

    expect(exit).toHaveBeenCalledWith(0);
    expect(dbIsClosed()).toBe(true);
  });

  it('принудительно выходит с кодом 1, если остановка зависла', async () => {
    const job = {
      stop: jest.fn(() => new Promise<void>(() => {
      }))
    };
    const shutdown = createShutdown({job, server, db: testDb.db, timeoutMs: 50, exit});

    void shutdown('SIGTERM');
    await sleep(150);

    expect(exit).toHaveBeenCalledWith(1);
    expect(Logger.error).toHaveBeenCalledWith(
      'Graceful shutdown timed out, forcing exit',
      expect.objectContaining({timeoutMs: 50}),
    );
  });

  it('при ошибке остановки задачи всё равно закрывает сервер и БД и выходит с кодом 1', async () => {
    const job = {stop: jest.fn().mockRejectedValue(new Error('job failed'))};
    const shutdown = createShutdown({job, server, db: testDb.db, timeoutMs: 1000, exit});

    await shutdown('SIGTERM');

    expect(server.listening).toBe(false);
    expect(dbIsClosed()).toBe(true);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
