import {CurrenciesRepository} from "../repository/CurrenciesRepository";
import {CurrencyPage, CurrencyQuery} from "../model/Currency";

export class CurrenciesService {
  constructor(private readonly currencies: CurrenciesRepository) {}

  list(query: CurrencyQuery): CurrencyPage {
    const { items, total } = this.currencies.findPage(query);
    return { items, total, limit: query.limit, offset: query.offset, syncedAt: this.currencies.lastSyncedAt() };
  }
}
