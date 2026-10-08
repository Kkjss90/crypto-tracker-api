import {PricePointResponse} from "./PricePointResponse";

export interface HistoryResponse {
  coinId: number;
  symbol: string;
  currency: string;
  items: PricePointResponse[];
  total: number;
  limit: number;
  offset: number;
}
