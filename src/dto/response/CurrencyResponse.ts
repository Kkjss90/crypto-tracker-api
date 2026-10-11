export interface CurrencyResponse {
  cmcId: number;
  symbol: string;
  name: string;
  slug: string;
  rank: number | null;
}

export interface CurrencyListResponse {
  items: CurrencyResponse[];
  total: number;
  limit: number;
  offset: number;
  syncedAt: string | null;
}
