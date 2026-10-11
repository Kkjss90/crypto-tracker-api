export interface CurrencyEntity {
  cmc_id: number;
  symbol: string;
  name: string;
  slug: string;
  cmc_rank: number | null;
  updated_at: string;
}
