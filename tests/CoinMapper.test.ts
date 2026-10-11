import {CoinEntity} from "../src/entity/CoinEntity";
import {toCoin, toCoinResponse} from "../src/mapper/CoinMapper";
import {createTimeFormatter} from "../src/utils/Time";

describe('coin mapper', () => {
  const entity: CoinEntity = {
    id: 1,
    cmc_id: 1027,
    symbol: 'ETH',
    name: 'Ethereum',
    created_at: '2026-10-07T10:00:00.000Z',
    updated_at: '2026-10-07T10:00:00.000Z',
  };

  it('entity → model: переименовывает поля и превращает дату в Date', () => {
    expect(toCoin(entity)).toEqual({
      id: 1,
      cmcId: 1027,
      symbol: 'ETH',
      name: 'Ethereum',
      createdAt: new Date('2026-10-07T10:00:00.000Z'),
      updatedAt: new Date('2026-10-07T10:00:00.000Z'),
    });
  });

  it('model → response DTO: отдаёт дату ISO-строкой', () => {
    expect(toCoinResponse(toCoin(entity), createTimeFormatter('Europe/Moscow'))).toEqual({
      id: 1,
      cmcId: 1027,
      symbol: 'ETH',
      name: 'Ethereum',
      createdAt: '2026-10-07T13:00:00.000+03:00',
      updatedAt: '2026-10-07T13:00:00.000+03:00',
    });
  });
});
