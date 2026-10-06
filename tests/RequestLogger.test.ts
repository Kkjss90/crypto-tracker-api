import request from 'supertest';
import {createTestApp, TestApp} from "./utils/TestApp";
import {Logger} from "../src/utils/Logger";

describe('request logging', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = createTestApp();
    jest.spyOn(Logger, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger, 'info').mockImplementation(() => {});
    jest.spyOn(Logger, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ctx.cleanup();
  });

  it('логирует успешный запрос и отдаёт X-Request-Id', async () => {
    const res = await request(ctx.app).get('/coins');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(Logger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        requestId: res.headers['x-request-id'],
        method: 'GET',
        path: '/coins',
        status: 200,
      }),
    );
  });

  it('логирует отклонённый запрос на уровне warn', async () => {
    await request(ctx.app).get('/coins/999');

    expect(Logger.warn).toHaveBeenCalledWith(
      'Request rejected',
      expect.objectContaining({ path: '/coins/999', status: 404 }),
    );
  });

  it('логирует серверную ошибку на уровне error со стектрейсом', async () => {
    const failure = new Error('boom');
    ctx.provider.failWith = failure;

    const res = await request(ctx.app).post('/coins').send({ symbol: 'BTC' });

    expect(res.status).toBe(500);
    expect(Logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({ status: 500 }),
    );
    expect(Logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      failure,
    );
  });

  it('не отдаёт клиенту детали внутренней ошибки', async () => {
    ctx.provider.failWith = new Error('secret internal details');

    const res = await request(ctx.app).post('/coins').send({ symbol: 'BTC' });

    expect(JSON.stringify(res.body)).not.toContain('secret internal details');
  });

  it('не логирует /health', async () => {
    await request(ctx.app).get('/health');

    expect(Logger.debug).not.toHaveBeenCalled();
    expect(Logger.info).not.toHaveBeenCalled();
  });

  it('не пишет в лог токены', async () => {
    await request(ctx.app)
      .post('/coins')
      .set('Authorization', 'Bearer super-secret-token')
      .send({ symbol: 'BTC' });

    const everything = JSON.stringify([
      (Logger.debug as jest.Mock).mock.calls,
      (Logger.info as jest.Mock).mock.calls,
      (Logger.warn as jest.Mock).mock.calls,
      (Logger.error as jest.Mock).mock.calls,
    ]);

    expect(everything).not.toContain('super-secret-token');
  });

  it('логирует добавление монеты', async () => {
    await request(ctx.app).post('/coins').send({ symbol: 'BTC' });

    expect(Logger.info).toHaveBeenCalledWith(
      'Coin added',
      expect.objectContaining({ symbol: 'BTC' }),
    );
  });
});
