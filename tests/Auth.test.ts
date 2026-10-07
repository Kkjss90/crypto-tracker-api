import request from 'supertest';
import {createTestApp, TEST_API_KEY} from "./utils/TestApp";
import type {TestApp} from "./utils/TestApp";
import {ApiKeyRepository} from "../src/repository/ApiKeyRepository";
import {AuthService} from "../src/service/AuthService";
import {Logger} from "../src/utils/Logger";
import {createHash} from "node:crypto";

type Method = 'get' | 'post' | 'patch' | 'delete';

describe('authentication', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ctx.cleanup();
  });

  const protectedEndpoints: Array<[Method, string]> = [
    ['post', '/coins'],
    ['get', '/coins'],
    ['get', '/coins/1'],
    ['patch', '/coins/1'],
    ['delete', '/coins/1'],
  ];

  it.each(protectedEndpoints)('%s %s без ключа возвращает 401', async (method, url) => {
    const res = await request(ctx.app)[method](url);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 содержит WWW-Authenticate и общее сообщение', async () => {
    const res = await request(ctx.app).get('/coins');

    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body.error.message).toBe('Invalid or missing API key');
  });

  it('401 для чужой схемы авторизации', async () => {
    const res = await request(ctx.app).get('/coins').set('Authorization', `Basic ${TEST_API_KEY}`);

    expect(res.status).toBe(401);
  });

  it('401 для пустого токена', async () => {
    const res = await request(ctx.app).get('/coins').set('Authorization', 'Bearer');

    expect(res.status).toBe(401);
  });

  it('401 для неверного ключа', async () => {
    const res = await request(ctx.app).get('/coins').set('Authorization', 'Bearer wrong-key');

    expect(res.status).toBe(401);
  });

  it('верный ключ пропускает запрос', async () => {
    const res = await ctx.http.get('/coins');

    expect(res.status).toBe(200);
  });

  it('схема Bearer не зависит от регистра', async () => {
    const res = await request(ctx.app).get('/coins').set('Authorization', `bearer ${TEST_API_KEY}`);

    expect(res.status).toBe(200);
  });

  it('/health доступен без ключа', async () => {
    const res = await request(ctx.app).get('/health');

    expect(res.status).toBe(200);
  });

  it('неизвестный маршрут без ключа даёт 404, а не 401', async () => {
    const res = await request(ctx.app).get('/no-such-route');

    expect(res.status).toBe(404);
  });

  it('логирует причину отказа, но не сам ключ', async () => {
    const warn = jest.spyOn(Logger, 'warn').mockImplementation(() => {
    });

    await request(ctx.app).get('/coins').set('Authorization', 'Bearer leaked-secret-key');

    expect(warn).toHaveBeenCalledWith(
      'Authentication failed',
      expect.objectContaining({reason: 'unknown or expired key'}),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('leaked-secret-key');
  });

  it('хранит в БД только хэш ключа', () => {
    const rows = ctx.db.prepare('SELECT key_hash FROM api_keys').all();

    expect(rows).toHaveLength(1);
    expect(rows[0].key_hash).not.toBe(TEST_API_KEY);
    expect(rows[0].key_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('повторное создание ключа не плодит дубликаты', () => {
    new AuthService(new ApiKeyRepository(ctx.db)).ensureKey('test', TEST_API_KEY);

    const row = ctx.db.prepare('SELECT COUNT(*) AS n FROM api_keys').get();
    expect(row?.n).toBe(1);
  });

  it('401 для истёкшего ключа', async () => {
    const expiredKey = 'expired-key-value';
    const keyHash = createHash('sha256').update(expiredKey).digest('hex');
    const past = new Date(Date.now() - 60 * 60 * 1000);

    ctx.db
      .prepare('INSERT INTO api_keys (name, key_hash, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run('expired', keyHash, past.toISOString(), new Date().toISOString());

    const res = await ctx.http
      .get('/coins')
      .set('Authorization', `Bearer ${expiredKey}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
