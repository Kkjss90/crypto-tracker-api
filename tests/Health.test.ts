import request from 'supertest';
import {HttpStatusCode} from "axios";
import {createTestApp} from "./utils/TestApp";

describe('GET /health', () => {
  it('возвращает 200 и статус ok', async () => {
    const res = await request(createTestApp().app).get('/health');

    expect(res.status).toBe(HttpStatusCode.Ok);
    expect(res.body).toEqual({status: HttpStatusCode.Ok, code: 'OK' });
  });
});

describe('неизвестный маршрут', () => {
  it('возвращает 404 в едином формате ошибки', async () => {
    const res = await request(createTestApp().app).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
