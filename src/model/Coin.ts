export interface Coin {
  id: number;
  cmcId: number;
  symbol: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewCoin = Pick<Coin, 'cmcId' | 'symbol' | 'name'>;
