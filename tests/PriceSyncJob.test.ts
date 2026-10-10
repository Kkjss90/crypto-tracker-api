import {createTestDb, TestDb} from "./utils/TestDb";
import {FakeProvider} from "./utils/FakeProvider";
import {CoinRepository} from "../src/repository/CoinRepository";
import {PriceRepository} from "../src/repository/PriceRepository";
import {PriceSyncJob} from "../src/job/PriceSyncJob";
import {Logger} from "../src/utils/Logger";
import {ExternalApiError} from "../src/error/ExternalApiError";

const INTERVAL = 1000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('PriceSyncJob', () => {
  let testDb: TestDb;
  let provider: FakeProvider;
  let coins: CoinRepository;
  let prices: PriceRepository;
  let job: PriceSyncJob;

  const rows = () =>
    testDb.db.prepare('SELECT coin_id, price, fetched_at FROM price_history ORDER BY id').all();

  const addBtc = () => coins.create({ cmcId: 1, symbol: 'BTC', name: 'Bitcoin' });
  const addEth = () => coins.create({ cmcId: 1027, symbol: 'ETH', name: 'Ethereum' });

  beforeEach(() => {
    testDb = createTestDb();
    provider = new FakeProvider();
    coins = new CoinRepository(testDb.db);
    prices = new PriceRepository(testDb.db);
    job = new PriceSyncJob({ coins, prices, provider, intervalMs: INTERVAL });

    jest.spyOn(Logger, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger, 'info').mockImplementation(() => {});
    jest.spyOn(Logger, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await job.stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
    testDb.cleanup();
  });

  describe('runOnce', () => {
    it('сохраняет цены всех монет одним запросом и с одним временем', async () => {
      const btc = addBtc();
      const eth = addEth();
      const spy = jest.spyOn(provider, 'getPrices');

      const result = await job.runOnce();

      expect(result).toEqual({ tracked: 2, saved: 2 });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith([1, 1027]);

      const saved = rows();
      expect(saved.map((row) => [row.coin_id, row.price])).toEqual([
        [btc.id, 43000],
        [eth.id, 2500],
      ]);
      expect(new Set(saved.map((row) => row.fetched_at)).size).toBe(1);
    });

    it('без монет не обращается к провайдеру', async () => {
      const spy = jest.spyOn(provider, 'getPrices');

      const result = await job.runOnce();

      expect(result).toEqual({ tracked: 0, saved: 0 });
      expect(spy).not.toHaveBeenCalled();
      expect(rows()).toHaveLength(0);
    });

    it('сохраняет только те цены, которые вернул провайдер', async () => {
      addBtc();
      addEth();
      provider.prices.delete(1027);

      const result = await job.runOnce();

      expect(result).toEqual({ tracked: 2, saved: 1 });
      expect(rows()).toHaveLength(1);
    });

    it('пробрасывает ошибку провайдера и ничего не пишет в БД', async () => {
      addBtc();
      provider.failWith = new ExternalApiError('provider is down');

      await expect(job.runOnce()).rejects.toBeInstanceOf(ExternalApiError);

      expect(rows()).toHaveLength(0);
    });

    it('монета, удалённая во время запроса, не ломает сохранение остальных', async () => {
      const btc = addBtc();
      const eth = addEth();
      provider.delayMs = 50;

      const run = job.runOnce();
      await sleep(10);
      coins.delete(btc.id);
      const result = await run;

      expect(result).toEqual({ tracked: 1, saved: 1 });
      expect(rows().map((row) => row.coin_id)).toEqual([eth.id]);
    });

    it('монета, добавленная во время запроса, ждёт следующего цикла', async () => {
      const btc = addBtc();
      provider.delayMs = 50;

      const run = job.runOnce();
      await sleep(10);
      addEth();
      const result = await run;

      expect(result).toEqual({ tracked: 2, saved: 1 });
      expect(rows().map((row) => row.coin_id)).toEqual([btc.id]);
    });
  });

  describe('PricesRepository.createMany', () => {
    it('откатывает всю пачку, если одна запись некорректна', () => {
      const btc = addBtc();
      const fetchedAt = new Date();

      expect(() =>
        prices.createMany([
          { coinId: btc.id, price: 1, fetchedAt },
          { coinId: 9999, price: 2, fetchedAt },
        ]),
      ).toThrow();

      expect(rows()).toHaveLength(0);
    });
  });

  describe('расписание', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
      addBtc();
    });

    it('первый запуск сразу, следующие через интервал', async () => {
      const spy = jest.spyOn(provider, 'getPrices');

      job.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(spy).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(INTERVAL - 1);
      expect(spy).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(rows()).toHaveLength(2);

      await job.stop();
    });

    it('повторный start() не запускает второй цикл', async () => {
      const spy = jest.spyOn(provider, 'getPrices');

      job.start();
      job.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(spy).toHaveBeenCalledTimes(1);
      await job.stop();
    });

    it('не накладывает запуски друг на друга при медленном провайдере', async () => {
      const spy = jest.spyOn(provider, 'getPrices');
      provider.delayMs = INTERVAL * 3;

      job.start();
      await jest.advanceTimersByTimeAsync(INTERVAL * 2.5);
      expect(spy).toHaveBeenCalledTimes(1);

      const stopped = job.stop();
      await jest.advanceTimersByTimeAsync(INTERVAL * 3);
      await stopped;

      expect(spy).toHaveBeenCalledTimes(1);
      expect(rows()).toHaveLength(1);
    });

    it('ошибка провайдера логируется, а цикл продолжается', async () => {
      provider.failWith = new ExternalApiError('provider is down');

      job.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(Logger.warn).toHaveBeenCalledWith(
        'Price sync failed: provider error',
        expect.objectContaining({ code: 'EXTERNAL_API_ERROR' }),
      );
      expect(rows()).toHaveLength(0);

      provider.failWith = null;
      await jest.advanceTimersByTimeAsync(INTERVAL);

      expect(rows()).toHaveLength(1);
      await job.stop();
    });

    it('неожиданная ошибка логируется как error, а цикл продолжается', async () => {
      const failure = new Error('boom');
      provider.failWith = failure;

      job.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(Logger.error).toHaveBeenCalledWith('Price sync failed unexpectedly', failure);

      provider.failWith = null;
      await jest.advanceTimersByTimeAsync(INTERVAL);

      expect(rows()).toHaveLength(1);
      await job.stop();
    });

    it('stop() отменяет следующий запуск', async () => {
      const spy = jest.spyOn(provider, 'getPrices');

      job.start();
      await jest.advanceTimersByTimeAsync(0);
      await job.stop();

      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(10 * INTERVAL);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('stop() ждёт текущую итерацию и её запись в БД', async () => {
      provider.delayMs = 5000;

      job.start();
      await jest.advanceTimersByTimeAsync(0);

      let finished = false;
      const stopped = job.stop().then(() => {
        finished = true;
      });

      await jest.advanceTimersByTimeAsync(4999);
      expect(finished).toBe(false);
      expect(rows()).toHaveLength(0);

      await jest.advanceTimersByTimeAsync(1);
      await stopped;

      expect(finished).toBe(true);
      expect(rows()).toHaveLength(1);
    });

    it('stop() идемпотентен, а start() после stop() игнорируется', async () => {
      const spy = jest.spyOn(provider, 'getPrices');

      await job.stop();
      await job.stop();
      job.start();
      await jest.advanceTimersByTimeAsync(INTERVAL * 10);

      expect(spy).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
