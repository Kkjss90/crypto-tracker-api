import request from 'supertest';
import {createTestApp, TestApp} from "./utils/TestApp";
import {ExternalApiError} from "../src/error/ExternalApiError";

describe('coins API', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  const addCoin = (symbol: string) => request(ctx.app).post('/coins').send({ symbol });

  describe('POST /coins', () => {
    it('создаёт монету и возвращает 201 с Location', async () => {
      const res = await addCoin('BTC');

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ cmcId: 1, symbol: 'BTC', name: 'Bitcoin' });
      expect(res.headers.location).toBe(`/coins/${res.body.id}`);
      expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
      expect(res.body).not.toHaveProperty('cmc_id');
      expect(res.body).not.toHaveProperty('created_at');
      expect(res.body).not.toHaveProperty('updated_at');
    });

    it('нормализует символ к верхнему регистру', async () => {
      const res = await addCoin(' btc ');

      expect(res.status).toBe(201);
      expect(res.body.symbol).toBe('BTC');
    });

    it('400 на некорректный символ', async () => {
      const res = await addCoin('BTC USDT');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('400 без тела запроса', async () => {
      const res = await request(ctx.app).post('/coins');

      expect(res.status).toBe(400);
    });

    it('400 на неизвестное поле', async () => {
      const res = await request(ctx.app).post('/coins').send({ symbol: 'BTC', extra: 1 });

      expect(res.status).toBe(400);
    });

    it('400 на битый JSON', async () => {
      const res = await request(ctx.app)
        .post('/coins')
        .set('Content-Type', 'application/json')
        .send('{bad json');

      expect(res.status).toBe(400);
    });

    it('404, если монеты нет на CoinMarketCap', async () => {
      const res = await addCoin('NOPE');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('409 на дубликат', async () => {
      await addCoin('BTC');
      const res = await addCoin('BTC');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('502, если источник цен недоступен', async () => {
      ctx.provider.failWith = new ExternalApiError('provider is down');
      const res = await addCoin('BTC');

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('EXTERNAL_API_ERROR');
    });

    it('при гонке двух одинаковых запросов один получает 409', async () => {
      ctx.provider.delayMs = 20;

      const [first, second] = await Promise.all([addCoin('BTC'), addCoin('BTC')]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
    });
  });

  describe('GET /coins', () => {
    it('возвращает пустой список', async () => {
      const res = await request(ctx.app).get('/coins');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('возвращает добавленные монеты', async () => {
      await addCoin('BTC');
      await addCoin('ETH');

      const res = await request(ctx.app).get('/coins');

      expect(res.status).toBe(200);
      expect(res.body.map((c: { symbol: string }) => c.symbol)).toEqual(['BTC', 'ETH']);
    });
  });

  describe('GET /coins/:id', () => {
    it('возвращает монету', async () => {
      const created = await addCoin('BTC');
      const res = await request(ctx.app).get(`/coins/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe('BTC');
    });

    it('404 для несуществующей монеты', async () => {
      const res = await request(ctx.app).get('/coins/999');

      expect(res.status).toBe(404);
    });

    it.each(['abc', '0', '-1', '1.5'])('400 для некорректного id "%s"', async (id) => {
      const res = await request(ctx.app).get(`/coins/${id}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /coins/:id', () => {
    it('переименовывает монету', async () => {
      const created = await addCoin('BTC');
      const res = await request(ctx.app).patch(`/coins/${created.body.id}`).send({ name: 'Digital Gold' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Digital Gold');
    });

    it('404 для несуществующей монеты', async () => {
      const res = await request(ctx.app).patch('/coins/999').send({ name: 'X' });

      expect(res.status).toBe(404);
    });

    it('400 на пустое имя', async () => {
      const created = await addCoin('BTC');
      const res = await request(ctx.app).patch(`/coins/${created.body.id}`).send({ name: '   ' });

      expect(res.status).toBe(400);
    });

    it('400 при попытке изменить symbol', async () => {
      const created = await addCoin('BTC');
      const res = await request(ctx.app).patch(`/coins/${created.body.id}`).send({ symbol: 'ETH' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /coins/:id', () => {
    it('удаляет монету и возвращает 204', async () => {
      const created = await addCoin('BTC');

      const del = await request(ctx.app).delete(`/coins/${created.body.id}`);
      const after = await request(ctx.app).get(`/coins/${created.body.id}`);

      expect(del.status).toBe(204);
      expect(after.status).toBe(404);
    });

    it('404 для несуществующей монеты', async () => {
      const res = await request(ctx.app).delete('/coins/999');

      expect(res.status).toBe(404);
    });

    it('400 для некорректного id', async () => {
      const res = await request(ctx.app).delete('/coins/abc');

      expect(res.status).toBe(400);
    });
  });
});
