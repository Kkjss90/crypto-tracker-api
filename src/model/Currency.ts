export interface Currency {
  cmcId: number;
  symbol: string;
  name: string;
  slug: string;
  rank: number | null;
}

export interface CurrencyQuery {
  search?: string;
  limit: number;
  offset: number;
}

export interface CurrencyPage {
  items: Currency[];
  total: number;
  limit: number;
  offset: number;
  syncedAt: Date | null;
}
