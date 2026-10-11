import {Db} from "../database/Connection";
import {Currency, CurrencyQuery} from "../model/Currency";
import {withTransaction} from "../database/Transaction";
import {toCurrency} from "../mapper/CurrencyMapper";
import {CurrencyEntity} from "../entity/CurrencyEntity";

const COLUMNS = 'cmc_id, symbol, name, slug, cmc_rank, updated_at';

export class CurrenciesRepository {
  constructor(private readonly db: Db) {}

  replaceAll(items: Currency[], syncedAt: Date): number {
    const stamp = syncedAt.toISOString();

    return withTransaction(this.db, () => {
      const upsert = this.db.prepare(
        `INSERT INTO currencies (cmc_id, symbol, name, slug, cmc_rank, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(cmc_id) DO UPDATE SET
           symbol = excluded.symbol, name = excluded.name, slug = excluded.slug,
           cmc_rank = excluded.cmc_rank, updated_at = excluded.updated_at`,
      );
      for (const item of items) {
        upsert.run(item.cmcId, item.symbol, item.name, item.slug, item.rank, stamp);
      }
      this.db.prepare('DELETE FROM currencies WHERE updated_at <> ?').run(stamp);
      return items.length;
    });
  }

  findPage(query: CurrencyQuery): { items: Currency[]; total: number } {
    const params: Array<string | number> = [];
    let where = '';

    if (query.search) {
      const needle = query.search.toLowerCase();
      where = 'WHERE instr(lower(symbol), ?) > 0 OR instr(lower(name), ?) > 0';
      params.push(needle, needle);
    }

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS n FROM currencies ${where}`)
      .get(...params) as { n: number };

    const rows = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM currencies ${where}
         ORDER BY cmc_rank IS NULL, cmc_rank, cmc_id
         LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit, query.offset);

    return {
      items: rows.map((row) => toCurrency(row as unknown as CurrencyEntity)),
      total: totalRow.n,
    };
  }

  lastSyncedAt(): Date | null {
    const row = this.db.prepare('SELECT MAX(updated_at) AS synced FROM currencies').get() as {
      synced: string | null;
    };
    return row.synced ? new Date(row.synced) : null;
  }
}
