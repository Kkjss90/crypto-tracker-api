import type {Db} from './Connection';
import {DataBaseError} from "../error/DataBaseError";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS coins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cmc_id     INTEGER NOT NULL UNIQUE,
    symbol     TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id    INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
    price      REAL    NOT NULL,
    fetched_at TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_price_history_coin_time
    ON price_history (coin_id, fetched_at);
    
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
      
  CREATE TABLE IF NOT EXISTS api_keys (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash   TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id);
  
  CREATE TABLE IF NOT EXISTS currencies (
    cmc_id     INTEGER PRIMARY KEY,
    symbol     TEXT NOT NULL,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL,
    cmc_rank   INTEGER,
    updated_at TEXT NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_currencies_rank ON currencies (cmc_rank);
  CREATE INDEX IF NOT EXISTS idx_currencies_symbol ON currencies (symbol);
`;

export function runMigrations(db: Db): void {
  db.exec('BEGIN');
  try {
    db.exec(SCHEMA);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new DataBaseError("Can't run migrations", error as Error);
  }
}
