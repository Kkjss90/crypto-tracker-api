import {PricePointResponse} from "./PricePointResponse";

export interface PriceResponse extends PricePointResponse {
  coinId: number;
  symbol: string;
  currency: string;
}
