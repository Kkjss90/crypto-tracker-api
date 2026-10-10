import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDb, Db} from "../../src/database/Connection";
import {runMigrations} from "../../src/database/Migration";
import {Logger} from "../../src/utils/Logger";

export interface TestDb {
  db: Db;
  cleanup: () => void;
}

export function createTestDb(): TestDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tracker-test-'));
  const db = createDb(path.join(dir, 'test.db'));
  runMigrations(db);

  return {
    db,
    cleanup: () => {
      try {
        db.close();
      } catch (error) {
        Logger.error('Failed to close the test database', error);
      }
      fs.rmSync(dir, {recursive: true, force: true});
    },
  };
}
