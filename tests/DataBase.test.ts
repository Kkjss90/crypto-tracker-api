import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDb} from "../src/database/Connection";
import {runMigrations} from "../src/database/Migration";
import {createTestDb, TestDb} from "./utils/TestDb";

describe('createDb', () => {
  it('создаёт вложенные папки и файл БД', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-tracker-test-'));
    const dbPath = path.join(root, 'nested', 'dir', 'app.db');

    const db = createDb(dbPath);
    try {
      expect(fs.existsSync(dbPath)).toBe(true);
    } finally {
      db.close();
      fs.rmSync(root, {recursive: true, force: true});
    }
  });

  it('включает проверку внешних ключей', () => {
    const {db, cleanup} = createTestDb();
    try {
      const row = db.prepare('PRAGMA foreign_keys').get();
      expect(row?.foreign_keys).toBe(1);
    } finally {
      cleanup();
    }
  });
});

describe('database migrations', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  const insertCoin = (cmcId: number, symbol: string) =>
    testDb.db
      .prepare('INSERT INTO coins (cmc_id, symbol, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(cmcId, symbol, 'Name', new Date().toISOString(), new Date().toISOString());

  const insertPrice = (coinId: number | bigint, price: number) =>
    testDb.db
      .prepare('INSERT INTO price_history (coin_id, price, fetched_at) VALUES (?, ?, ?)')
      .run(coinId, price, new Date().toISOString());

  it('создаёт все таблицы', () => {
    const rows = testDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all();
    const names = rows.map((r) => r.name).sort();

    expect(names).toEqual(['api_keys', 'coins', 'price_history']);
  });

  it('повторный запуск миграций не падает', () => {
    expect(() => runMigrations(testDb.db)).not.toThrow();
  });

  it('не даёт создать монету с дублирующим символом', () => {
    insertCoin(1, 'BTC');
    expect(() => insertCoin(2, 'BTC')).toThrow();
  });

  it('не даёт создать монету с дублирующим cmc_id', () => {
    insertCoin(1, 'BTC');
    expect(() => insertCoin(1, 'XBT')).toThrow();
  });

  it('не даёт добавить цену для несуществующей монеты (внешний ключ)', () => {
    expect(() => insertPrice(999, 1.5)).toThrow();
  });

  it('хранит цену как число', () => {
    const {lastInsertRowid} = insertCoin(1, 'BTC');
    insertPrice(lastInsertRowid, 43250.12);

    const row = testDb.db.prepare('SELECT price FROM price_history').get();
    expect(row?.price).toBe(43250.12);
  });

  it('удаляет историю вместе с монетой (каскад)', () => {
    const {lastInsertRowid} = insertCoin(1, 'BTC');
    insertPrice(lastInsertRowid, 1.5);

    testDb.db.prepare('DELETE FROM coins WHERE id = ?').run(lastInsertRowid);

    const left = testDb.db.prepare('SELECT COUNT(*) AS n FROM price_history').get();
    expect(left?.n).toBe(0);
  });
});
