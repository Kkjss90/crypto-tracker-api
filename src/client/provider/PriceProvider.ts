import {Currency} from "../../model/Currency";

export interface CoinInfo {
  cmcId: number;
  symbol: string;
  name: string;
}

export interface PriceProvider {
  findCoinBySymbol(symbol: string): Promise<CoinInfo | null>;
  getPrices(cmcIds: number[]): Promise<Map<number, number>>;
}

export interface CurrencyCatalogProvider {
  listCurrencies(): Promise<Currency[]>;
}
