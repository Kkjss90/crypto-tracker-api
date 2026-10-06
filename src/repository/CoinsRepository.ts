import {CoinEntity} from "../entity/CoinEntity";
import {Coin, NewCoin} from "../model/Coin";
import {toCoin} from "../mapper/CoinMapper";
import {Db} from "../database/Connection";

const COLUMNS = 'id, cmc_id, symbol, name, created_at, updated_at';

function asEntity(row: unknown): CoinEntity {
  return row as CoinEntity;
}

export class CoinsRepository {
  constructor(private readonly db: Db) {}

  create(coin: NewCoin): Coin {
    const createdAt = new Date();
    const updatedAt = createdAt;
    const result = this.db
      .prepare('INSERT INTO coins (cmc_id, symbol, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(coin.cmcId, coin.symbol, coin.name, createdAt.toISOString(), updatedAt.toISOString());

    return { id: Number(result.lastInsertRowid), ...coin, createdAt, updatedAt};
  }

  findAll(): Coin[] {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM coins ORDER BY id`)
      .all()
      .map((row) => toCoin(asEntity(row)));
  }

  findById(id: number): Coin | undefined {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM coins WHERE id = ?`).get(id);
    return row ? toCoin(asEntity(row)) : undefined;
  }

  findBySymbol(symbol: string): Coin | undefined {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM coins WHERE symbol = ?`).get(symbol);
    return row ? toCoin(asEntity(row)) : undefined;
  }

  findByCmcId(cmcId: number): Coin | undefined {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM coins WHERE cmc_id = ?`).get(cmcId);
    return row ? toCoin(asEntity(row)) : undefined;
  }

  updateName(id: number, name: string): Coin | undefined {
    const result = this.db.prepare('UPDATE coins SET name = ? WHERE id = ?').run(name, id);
    return Number(result.changes) === 0 ? undefined : this.findById(id);
  }

  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM coins WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }
}
