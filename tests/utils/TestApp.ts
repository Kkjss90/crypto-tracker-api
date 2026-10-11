import request from 'supertest';
import type {Express} from 'express';
import {FakeProvider} from "./FakeProvider";
import {Db} from "../../src/database/Connection";
import {createTestDb} from "./TestDb";
import {createAuthService} from "../../src/service/AuthService";
import {createApp} from "../../src/App";

export const TEST_API_KEY = 'test-api-key-0123456789';
export const TEST_TTL_DAYS = 30;

export function createHttpClient(app: Express, apiKey: string) {
  const auth = {Authorization: `Bearer ${apiKey}`};

  return {
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string) => request(app).post(url).set(auth),
    patch: (url: string) => request(app).patch(url).set(auth),
    delete: (url: string) => request(app).delete(url).set(auth),
  };
}

export interface TestApp {
  app: Express;
  provider: FakeProvider;
  db: Db;
  http: ReturnType<typeof createHttpClient>;
  cleanup: () => void;
}

export interface TestAppOptions {
  timeZone?: string;
}

export function createTestApp(options: TestAppOptions = {}): TestApp {
  const { db, cleanup } = createTestDb();
  createAuthService(db, TEST_TTL_DAYS).ensureBootstrapKey(TEST_API_KEY);

  const provider = new FakeProvider();
  const app = createApp({ db, provider, apiKeyTtlDays: TEST_TTL_DAYS, timeZone: options.timeZone ?? 'UTC' });

  return { app, provider, db, http: createHttpClient(app, TEST_API_KEY), cleanup };
}
