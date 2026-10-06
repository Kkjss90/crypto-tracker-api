import type {CoinInfo, PriceProvider} from "../../src/client/provider/PriceProvider";

const KNOWN_COINS: CoinInfo[] = [
  { cmcId: 1, symbol: 'BTC', name: 'Bitcoin' },
  { cmcId: 1027, symbol: 'ETH', name: 'Ethereum' },
];

export class FakeProvider implements PriceProvider {
  failWith: Error | null = null;
  delayMs = 0;
  prices = new Map<number, number>([
    [1, 43000],
    [1027, 2500],
  ]);

  async findCoinBySymbol(symbol: string): Promise<CoinInfo | null> {
    await this.pause();
    if (this.failWith) throw this.failWith;
    return KNOWN_COINS.find((coin) => coin.symbol === symbol) ?? null;
  }

  async getPrices(cmcIds: number[]): Promise<Map<number, number>> {
    await this.pause();
    if (this.failWith) throw this.failWith;

    const result = new Map<number, number>();
    for (const id of cmcIds) {
      const price = this.prices.get(id);
      if (price !== undefined) result.set(id, price);
    }
    return result;
  }

  private pause(): Promise<void> {
    return this.delayMs > 0
      ? new Promise((resolve) => setTimeout(resolve, this.delayMs))
      : Promise.resolve();
  }
}
