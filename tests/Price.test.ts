import {HttpStatusCode} from 'axios';
import request from 'supertest';
import {createTestApp, TestApp} from "./utils/TestApp";
import {PriceRepository} from "../src/repository/PriceRepository";
import {ExternalApiError} from "../src/error/ExternalApiError";
import {CoinRepository} from "../src/repository/CoinRepository";
import {PriceSyncJob} from "../src/job/PriceSyncJob";

const T10 = '2026-10-07T10:00:00.000Z';
const T11 = '2026-10-07T11:00:00.000Z';
const T12 = '2026-10-07T12:00:00.000Z';

describe('prices API', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  async function addCoin(symbol: string): Promise<number> {
    const res = await ctx.http.post('/coins').send({symbol});
    return res.body.id as number;
  }

  const seed = (coinId: number, price: number, iso: string) =>
    new PriceRepository(ctx.db).create({coinId, price, fetchedAt: new Date(iso)});

  const historyRowCount = () => {
    const row = ctx.db.prepare('SELECT COUNT(*) AS n FROM price_history').get();
    return row?.n;
  };

  describe('GET /coins/:id/price', () => {
    it('401 без ключа', async () => {
      const res = await request(ctx.app).get('/coins/1/price');

      expect(res.status).toBe(401);
    });

    it('возвращает цену и сохраняет её в историю', async () => {
      const id = await addCoin('BTC');

      const res = await ctx.http.get(`/coins/${id}/price`);
      const history = await ctx.http.get(`/coins/${id}/history`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({coinId: id, symbol: 'BTC', currency: 'USD', price: 43000});
      expect(new Date(res.body.fetchedAt).toISOString()).toBe(res.body.fetchedAt);
      expect(history.body.total).toBe(1);
      expect(res.body).toMatchObject({ coinId: id, symbol: 'BTC', currency: 'USD', price: 43000, recorded: true });    });

    it('404 для несуществующей монеты', async () => {
      const res = await ctx.http.get('/coins/999/price');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it.each(['abc', '0', '-1', '1.5'])('400 для некорректного id "%s"', async (id) => {
      const res = await ctx.http.get(`/coins/${id}/price`);

      expect(res.status).toBe(400);
    });

    it('502, если источник цен недоступен, и ничего не сохраняется', async () => {
      const id = await addCoin('BTC');
      ctx.provider.failWith = new ExternalApiError('provider is down');

      const res = await ctx.http.get(`/coins/${id}/price`);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('EXTERNAL_API_ERROR');
      expect(historyRowCount()).toBe(0);
    });

    it('504, если источник цен не ответил вовремя', async () => {
      const id = await addCoin('BTC');
      ctx.provider.failWith = new ExternalApiError('timeout', HttpStatusCode.GatewayTimeout);

      const res = await ctx.http.get(`/coins/${id}/price`);

      expect(res.status).toBe(504);
    });

    it('502, если источник не вернул цену для монеты', async () => {
      const id = await addCoin('BTC');
      ctx.provider.prices.delete(1);

      const res = await ctx.http.get(`/coins/${id}/price`);

      expect(res.status).toBe(502);
      expect(historyRowCount()).toBe(0);
    });

    it('404, а не 500, если монету удалили, пока шёл запрос к источнику', async () => {
      const id = await addCoin('BTC');
      ctx.provider.delayMs = 50;

      const pending = ctx.http.get(`/coins/${id}/price`).then((res) => res);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const removed = await ctx.http.delete(`/coins/${id}`);
      const res = await pending;

      expect(removed.status).toBe(204);
      expect(res.status).toBe(404);
      expect(historyRowCount()).toBe(0);
    });
  });

  describe('GET /coins/:id/history', () => {
    it('401 без ключа', async () => {
      const res = await request(ctx.app).get('/coins/1/history');

      expect(res.status).toBe(401);
    });

    it('404 для несуществующей монеты', async () => {
      const res = await ctx.http.get('/coins/999/history');

      expect(res.status).toBe(404);
    });

    it('пустая история это 200 и пустой список', async () => {
      const id = await addCoin('BTC');

      const res = await ctx.http.get(`/coins/${id}/history`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        coinId: id,
        symbol: 'BTC',
        currency: 'USD',
        items: [],
        total: 0,
        limit: 100,
        offset: 0,
      });
    });

    it('новые записи идут первыми, наружу уходят только цена и время', async () => {
      const id = await addCoin('BTC');
      seed(id, 1, T10);
      seed(id, 2, T11);
      seed(id, 3, T12);

      const res = await ctx.http.get(`/coins/${id}/history`);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([
        {price: 3, fetchedAt: T12},
        {price: 2, fetchedAt: T11},
        {price: 1, fetchedAt: T10},
      ]);
      expect(res.body.total).toBe(3);
    });

    it('не смешивает историю разных монет', async () => {
      const btc = await addCoin('BTC');
      const eth = await addCoin('ETH');
      seed(btc, 1, T10);
      seed(eth, 999, T11);

      const res = await ctx.http.get(`/coins/${btc}/history`);

      expect(res.body.items).toEqual([{price: 1, fetchedAt: T10}]);
      expect(res.body.total).toBe(1);
    });

    it('order=asc переворачивает порядок', async () => {
      const id = await addCoin('BTC');
      seed(id, 1, T10);
      seed(id, 2, T11);
      seed(id, 3, T12);

      const res = await ctx.http.get(`/coins/${id}/history`).query({order: 'asc'});

      expect(res.body.items.map((p: { price: number }) => p.price)).toEqual([1, 2, 3]);
    });

    describe('фильтры по времени', () => {
      let id: number;
      const prices = (res: { body: { items: Array<{ price: number }> } }) => res.body.items.map((p) => p.price);

      beforeEach(async () => {
        id = await addCoin('BTC');
        seed(id, 1, T10);
        seed(id, 2, T11);
        seed(id, 3, T12);
      });

      it('from включительно', async () => {
        const res = await ctx.http.get(`/coins/${id}/history`).query({from: T11});

        expect(prices(res)).toEqual([3, 2]);
        expect(res.body.total).toBe(2);
      });

      it('to включительно', async () => {
        const res = await ctx.http.get(`/coins/${id}/history`).query({to: T11});

        expect(prices(res)).toEqual([2, 1]);
      });

      it('from и to вместе', async () => {
        const res = await ctx.http.get(`/coins/${id}/history`).query({from: T11, to: T11});

        expect(prices(res)).toEqual([2]);
      });

      it('понимает часовой пояс со смещением', async () => {
        const res = await ctx.http.get(`/coins/${id}/history?from=2026-10-07T14:00:00%2B03:00`);

        expect(prices(res)).toEqual([3, 2]);
      });

      it('диапазон без данных даёт пустой список', async () => {
        const res = await ctx.http.get(`/coins/${id}/history`).query({from: '2027-01-01T00:00:00Z'});

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.total).toBe(0);
      });
    });

    describe('пагинация', () => {
      it('limit и offset делят список, total остаётся общим', async () => {
        const id = await addCoin('BTC');
        seed(id, 1, T10);
        seed(id, 2, T11);
        seed(id, 3, T12);

        const res = await ctx.http.get(`/coins/${id}/history`).query({limit: '2', offset: '1'});

        expect(res.body.items.map((p: { price: number }) => p.price)).toEqual([2, 1]);
        expect(res.body).toMatchObject({total: 3, limit: 2, offset: 1});
      });

      it('записи с одинаковым временем не теряются и не дублируются между страницами', async () => {
        const id = await addCoin('BTC');
        seed(id, 1, T10);
        seed(id, 2, T10);
        seed(id, 3, T10);

        const first = await ctx.http.get(`/coins/${id}/history`).query({limit: '2', offset: '0'});
        const second = await ctx.http.get(`/coins/${id}/history`).query({limit: '2', offset: '2'});
        const seen = [...first.body.items, ...second.body.items].map((p: { price: number }) => p.price);

        expect(seen.sort()).toEqual([1, 2, 3]);
      });
    });

    it.each([
      ['from не дата', {from: 'yesterday'}],
      ['from без времени', {from: '2026-10-07'}],
      ['from без часового пояса', {from: '2026-10-07T10:00:00'}],
      ['from с несуществующей датой', {from: '2026-02-31T00:00:00Z'}],
      ['from вне допустимых лет', {from: '1900-01-01T00:00:00Z'}],
      ['пустой from', {from: ''}],
      ['to не дата', {to: 'tomorrow'}],
      ['limit = 0', {limit: '0'}],
      ['limit больше максимума', {limit: '1001'}],
      ['limit отрицательный', {limit: '-1'}],
      ['limit дробный', {limit: '1.5'}],
      ['limit не число', {limit: 'abc'}],
      ['offset отрицательный', {offset: '-1'}],
      ['offset не число', {offset: 'x'}],
      ['order неизвестный', {order: 'sideways'}],
      ['неизвестный параметр', {lmit: '5'}],
      ['from позже to', {from: T12, to: T10}],
    ])('400: %s', async (_name, params) => {
      const id = await addCoin('BTC');

      const res = await ctx.http.get(`/coins/${id}/history`).query(params);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('400 на повторяющийся параметр', async () => {
      const id = await addCoin('BTC');

      const res = await ctx.http.get(`/coins/${id}/history?limit=1&limit=2`);

      expect(res.status).toBe(400);
    });

    it('400 для некорректного id', async () => {
      const res = await ctx.http.get('/coins/abc/history');

      expect(res.status).toBe(400);
    });
  });

  describe('дубликаты цен', () => {
    const priceUrl = (id: number) => `/coins/${id}/price`;
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const storedPrices = () => ctx.db.prepare('SELECT price FROM price_history ORDER BY id').all().map((r) => r.price);

    it('повторный запрос с той же ценой возвращает цену, но не пишет в историю', async () => {
      const id = await addCoin('BTC');

      const first = await ctx.http.get(priceUrl(id));
      const second = await ctx.http.get(priceUrl(id));

      expect(first.body.recorded).toBe(true);
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({ coinId: id, price: 43000, recorded: false });
      expect(historyRowCount()).toBe(1);
    });

    it('fetchedAt ответа это момент запроса, а в истории остаётся время записи', async () => {
      const id = await addCoin('BTC');

      const first = await ctx.http.get(priceUrl(id));
      await sleep(5);
      const second = await ctx.http.get(priceUrl(id));
      const history = await ctx.http.get(`/coins/${id}/history`);

      expect(Date.parse(second.body.fetchedAt)).toBeGreaterThan(Date.parse(first.body.fetchedAt));
      expect(history.body.items).toEqual([{ price: 43000, fetchedAt: first.body.fetchedAt }]);
    });

    it('изменившаяся цена сохраняется', async () => {
      const id = await addCoin('BTC');
      await ctx.http.get(priceUrl(id));
      ctx.provider.prices.set(1, 44000);

      const res = await ctx.http.get(priceUrl(id));

      expect(res.body).toMatchObject({ price: 44000, recorded: true });
      expect(storedPrices()).toEqual([43000, 44000]);
    });

    it('возврат к прежней цене сохраняется (сравнение только с последней записью)', async () => {
      const id = await addCoin('BTC');
      await ctx.http.get(priceUrl(id));
      ctx.provider.prices.set(1, 44000);
      await ctx.http.get(priceUrl(id));
      ctx.provider.prices.set(1, 43000);
      await ctx.http.get(priceUrl(id));

      expect(storedPrices()).toEqual([43000, 44000, 43000]);
    });

    it('учитывает записи фоновой задачи', async () => {
      const id = await addCoin('BTC');
      const job = new PriceSyncJob({
        coins: new CoinRepository(ctx.db),
        prices: new PriceRepository(ctx.db),
        provider: ctx.provider,
        intervalMs: 60_000,
      });
      await job.runOnce();

      const res = await ctx.http.get(priceUrl(id));

      expect(res.body.recorded).toBe(false);
      expect(historyRowCount()).toBe(1);
    });

    it('фоновая задача учитывает записи ручного запроса', async () => {
      const id = await addCoin('BTC');
      await ctx.http.get(priceUrl(id));
      const job = new PriceSyncJob({
        coins: new CoinRepository(ctx.db),
        prices: new PriceRepository(ctx.db),
        provider: ctx.provider,
        intervalMs: 60_000,
      });

      const result = await job.runOnce();

      expect(result).toEqual({ tracked: 1, saved: 0, unchanged: 1 });
    });

    it('два одновременных запроса с одной ценой дают ровно одну запись', async () => {
      const id = await addCoin('BTC');
      ctx.provider.delayMs = 20;

      const [a, b] = await Promise.all([ctx.http.get(priceUrl(id)), ctx.http.get(priceUrl(id))]);

      expect([a.body.recorded, b.body.recorded].sort()).toEqual([false, true]);
      expect(historyRowCount()).toBe(1);
    });
  });
});
