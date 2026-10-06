import request from 'supertest';
import {createApp} from '../src/App';
import {HttpStatusCode} from "axios";

describe('GET /health', () => {
  it('возвращает 200 и статус ok', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(HttpStatusCode.Ok);
    expect(res.body).toEqual({status: HttpStatusCode.Ok});
  });
});

describe('неизвестный маршрут', () => {
  it('возвращает 404 в едином формате ошибки', async () => {
    const res = await request(createApp()).get('/no-such-route');

    expect(res.status).toBe(HttpStatusCode.NotFound);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
