import {Db} from "../database/Connection";
import {HistoryQuery, NewPricePoint, PricePoint} from "../model/PricePoint";
import {PriceHistoryEntity} from "../entity/PriceHistoryEntity";
import {toPricePoint} from "../mapper/PriceMapper";
import {withTransaction} from "../database/Transaction";

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

  saveChanged(points: NewPricePoint[]): number {
    if (points.length === 0) return 0;

    return withTransaction(this.db, () => {
      const latest = this.db.prepare(
        'SELECT price FROM price_history WHERE coin_id = ? ORDER BY fetched_at DESC, id DESC LIMIT 1',
      );
      const insert = this.db.prepare('INSERT INTO price_history (coin_id, price, fetched_at) VALUES (?, ?, ?)');

      let saved = 0;
      for (const point of points) {
        const last = latest.get(point.coinId) as { price: number } | undefined;
        if (last !== undefined && last.price === point.price) continue;

        insert.run(point.coinId, point.price, point.fetchedAt.toISOString());
        saved += 1;
      }
      return saved;
    });
  }
}
