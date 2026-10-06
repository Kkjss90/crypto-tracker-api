import type { Express } from 'express';
import {FakeProvider} from "./FakeProvider";
import type {Db} from "../../src/database/Connection";
import {createTestDb} from "./DataBaseUtils";
import {createApp} from "../../src/App";

export interface TestApp {
  app: Express;
  provider: FakeProvider;
  db: Db;
  cleanup: () => void;
}

export function createTestApp(): TestApp {
  const { db, cleanup } = createTestDb();
  const provider = new FakeProvider();
  const app = createApp({ db, provider });

  return { app, provider, db, cleanup };
}
