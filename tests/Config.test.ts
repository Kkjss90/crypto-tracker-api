import {loadConfig} from "../src/config/Config";

describe('loadConfig', () => {
  const base = { BOOTSTRAP_API_KEY: 'secret', CMC_API_KEY: 'cmc-key' };

  it('подставляет значения по умолчанию', () => {
    const config = loadConfig(base);

    expect(config.port).toBe(3000);
    expect(config.dbPath).toBe('./data/app.db');
    expect(config.cmcBaseUrl).toBe('https://pro-api.coinmarketcap.com');
    expect(config.httpTimeoutMs).toBe(5000);
    expect(config.syncIntervalMs).toBe(300000);
    expect(config.bootstrapApiKey).toBe('secret');
    expect(config.cmcApiKey).toBe('cmc-key');
  });

  it('читает значения из env', () => {
    const config = loadConfig({ ...base, PORT: '8080', SYNC_INTERVAL_MS: '600000' });

    expect(config.port).toBe(8080);
    expect(config.syncIntervalMs).toBe(600_000);
  });

  it('падает без BOOTSTRAP_API_KEY', () => {
    expect(() => loadConfig({ CMC_API_KEY: 'cmc-key' })).toThrow('BOOTSTRAP_API_KEY');
  });

  it('падает без CMC_API_KEY', () => {
    expect(() => loadConfig({ BOOTSTRAP_API_KEY: 'secret' })).toThrow('CMC_API_KEY');
  });

  it('падает на некорректном числе', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow('PORT');
    expect(() => loadConfig({ ...base, PORT: '-5' })).toThrow('PORT');
    expect(() => loadConfig({ ...base, HTTP_TIMEOUT_MS: '0' })).toThrow('HTTP_TIMEOUT_MS');
  });

  it('не разрешает БД в памяти', () => {
    expect(() => loadConfig({ ...base, DB_PATH: ':memory:' })).toThrow('DB_PATH');
  });
});
