import {Db} from "../database/Connection";
import {HistoryQuery, NewPricePoint, PricePoint} from "../model/PricePoint";
import {PriceHistoryEntity} from "../entity/PriceHistoryEntity";
import {toPricePoint} from "../mapper/PriceMapper";

const DIRECTION = {asc: 'ASC', desc: 'DESC'} as const;

export class PriceRepository {
  constructor(private readonly db: Db) {
  }

  create(point: NewPricePoint): PricePoint {
    const result = this.db
      .prepare('INSERT INTO price_history (coin_id, price, fetched_at) VALUES (?, ?, ?)')
      .run(point.coinId, point.price, point.fetchedAt.toISOString());

    return {id: Number(result.lastInsertRowid), ...point};
  }

  findPage(coinId: number, query: HistoryQuery): { items: PricePoint[]; total: number } {
    const conditions = ['coin_id = ?'];
    const params: Array<string | number> = [coinId];

    if (query.from) {
      conditions.push('fetched_at >= ?');
      params.push(query.from.toISOString());
    }
    if (query.to) {
      conditions.push('fetched_at <= ?');
      params.push(query.to.toISOString());
    }

    const where = conditions.join(' AND ');
    const direction = DIRECTION[query.order];

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS n FROM price_history WHERE ${where}`)
      .get(...params) as { n: number };

    const rows = this.db
      .prepare(
        `SELECT id, coin_id, price, fetched_at FROM price_history
         WHERE ${where}
         ORDER BY fetched_at ${direction}, id ${direction}
         LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit, query.offset);

    return {
      items: rows.map((row) => toPricePoint(row as unknown as PriceHistoryEntity)),
      total: totalRow.n,
    };
  }
}
