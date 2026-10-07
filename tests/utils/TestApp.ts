import request from 'supertest';
import type {Express} from 'express';
import {FakeProvider} from "./FakeProvider";
import {Db} from "../../src/database/Connection";
import {createTestDb} from "./TestDb";
import {ApiKeyRepository} from "../../src/repository/ApiKeyRepository";
import {AuthService} from "../../src/service/AuthService";
import {createApp} from "../../src/App";

export const TEST_API_KEY = 'test-api-key-0123456789';

function createAuthorizedHttp(app: Express) {
  const auth = {Authorization: `Bearer ${TEST_API_KEY}`};

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
  http: ReturnType<typeof createAuthorizedHttp>;
  cleanup: () => void;
}

export function createTestApp(): TestApp {
  const {db, cleanup} = createTestDb();
  new AuthService(new ApiKeyRepository(db)).ensureKey('test', TEST_API_KEY);

  const provider = new FakeProvider();
  const app = createApp({db, provider});

  return {app, provider, db, http: createAuthorizedHttp(app), cleanup};
}
