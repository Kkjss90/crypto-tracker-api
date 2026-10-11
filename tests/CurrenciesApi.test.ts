import request from 'supertest';
import {Currency} from "../src/model/Currency";
import {createTestApp, TestApp} from "./utils/TestApp";
import {CurrenciesRepository} from "../src/repository/CurrenciesRepository";

const BTC: Currency = { cmcId: 1, symbol: 'BTC', name: 'Bitcoin', slug: 'bitcoin', rank: 1 };
const ETH: Currency = { cmcId: 1027, symbol: 'ETH', name: 'Ethereum', slug: 'ethereum', rank: 2 };
const NEW: Currency = { cmcId: 900, symbol: 'NEW', name: 'Brand New Coin', slug: 'brand-new', rank: null };

describe('GET /currencies', () => {
  let ctx: TestApp;
  let repository: CurrenciesRepository;

  beforeEach(() => {
    ctx = createTestApp();
    repository = new CurrenciesRepository(ctx.db);
  });

  afterEach(() => {
    ctx.cleanup();
  });

  const symbols = (res: { body: { items: Array<{ symbol: string }> } }) => res.body.items.map((item) => item.symbol);

  it('401 без ключа', async () => {
    const res = await request(ctx.app).get('/currencies');

    expect(res.status).toBe(401);
  });

  it('пустой каталог это 200, пустой список и syncedAt = null', async () => {
    const res = await ctx.http.get('/currencies');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, limit: 100, offset: 0, syncedAt: null });
  });

  it('сортирует по рангу, монеты без ранга в конце', async () => {
    repository.replaceAll([NEW, ETH, BTC], new Date('2026-10-07T10:00:00.000Z'));

    const res = await ctx.http.get('/currencies');

    expect(symbols(res)).toEqual(['BTC', 'ETH', 'NEW']);
    expect(res.body.items[0]).toEqual({ cmcId: 1, symbol: 'BTC', name: 'Bitcoin', slug: 'bitcoin', rank: 1 });
    expect(res.body.items[2].rank).toBeNull();
    expect(res.body.syncedAt).toBe('2026-10-07T10:00:00.000Z');
  });

  it('ищет по подстроке тикера или названия без учёта регистра', async () => {
    repository.replaceAll([BTC, ETH, NEW], new Date());

    expect(symbols(await ctx.http.get('/currencies').query({ search: 'btc' }))).toEqual(['BTC']);
    expect(symbols(await ctx.http.get('/currencies').query({ search: 'ETHER' }))).toEqual(['ETH']);
    expect(symbols(await ctx.http.get('/currencies').query({ search: 'coin' }))).toEqual(['BTC', 'NEW']);
    expect(symbols(await ctx.http.get('/currencies').query({ search: 'brand' }))).toEqual(['NEW']);
    expect((await ctx.http.get('/currencies').query({ search: 'zzz' })).body.total).toBe(0);
  });

  it('символы подстановки LIKE в поиске считаются обычными символами', async () => {
    repository.replaceAll([BTC, ETH], new Date());

    const percent = await ctx.http.get('/currencies').query({ search: '%' });
    const underscore = await ctx.http.get('/currencies').query({ search: '_' });

    expect(percent.body.total).toBe(0);
    expect(underscore.body.total).toBe(0);
  });

  it('limit и offset делят список, total общий', async () => {
    repository.replaceAll([BTC, ETH, NEW], new Date());

    const res = await ctx.http.get('/currencies').query({ limit: '1', offset: '1' });

    expect(symbols(res)).toEqual(['ETH']);
    expect(res.body).toMatchObject({ total: 3, limit: 1, offset: 1 });
  });

  it('время обновления отдаётся в настроенном часовом поясе', async () => {
    const moscow = createTestApp({ timeZone: 'Europe/Moscow' });
    try {
      new CurrenciesRepository(moscow.db).replaceAll([BTC], new Date('2026-10-07T10:00:00.000Z'));

      const res = await moscow.http.get('/currencies');

      expect(res.body.syncedAt).toBe('2026-10-07T13:00:00.000+03:00');
    } finally {
      moscow.cleanup();
    }
  });

  it.each([
    ['limit = 0', { limit: '0' }],
    ['limit больше максимума', { limit: '501' }],
    ['limit отрицательный', { limit: '-1' }],
    ['limit дробный', { limit: '1.5' }],
    ['limit не число', { limit: 'abc' }],
    ['offset отрицательный', { offset: '-1' }],
    ['offset не число', { offset: 'x' }],
    ['пустой search', { search: '' }],
    ['слишком длинный search', { search: 'x'.repeat(51) }],
    ['неизвестный параметр', { q: 'btc' }],
  ])('400: %s', async (_name, params) => {
    const res = await ctx.http.get('/currencies').query(params);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 на повторяющийся параметр', async () => {
    const res = await ctx.http.get('/currencies?limit=1&limit=2');

    expect(res.status).toBe(400);
  });
});
