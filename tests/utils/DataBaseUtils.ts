import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDb, Db} from "../../src/database/Connection";
import {runMigrations} from "../../src/database/Migration";

export interface DataBaseUtils {
  db: Db;
  cleanup: () => void;
}

export function createTestDb(): DataBaseUtils {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tracker-test-'));
  const db = createDb(path.join(dir, 'test.db'));
  runMigrations(db);

  return {
    db,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
