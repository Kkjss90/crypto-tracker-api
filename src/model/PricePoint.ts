import {Coin} from "./Coin";

export const PRICE_CURRENCY = 'USD';

export interface PricePoint {
  id: number;
  coinId: number;
  price: number;
  fetchedAt: Date;
}

export type NewPricePoint = Omit<PricePoint, 'id'>;

export type SortOrder = 'asc' | 'desc';

export interface HistoryQuery {
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
  order: SortOrder;
}

export interface HistoryPage {
  items: PricePoint[];
  total: number;
  limit: number;
  offset: number;
}

export interface CurrentPrice {
  coin: Coin;
  price: number;
  fetchedAt: Date;
  recorded: boolean;
}
