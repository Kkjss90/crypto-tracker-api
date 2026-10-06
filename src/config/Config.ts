export interface Config{
  port: number;
  dbPath: string;
  cmcBaseUrl: string;
  httpTimeoutMs: number;
  syncIntervalMs: number;
  bootstrapApiKey: string;
  cmcApiKey: string;
}

function readString(env: NodeJS.ProcessEnv, name: string, fallback?: string): string {
  const raw = env[name]?.trim();
  if (raw) return raw;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env variable: ${name}`);
}

function readPositiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Env variable ${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

function readDbPath(env: NodeJS.ProcessEnv): string {
  const dbPath = readString(env, 'DB_PATH', './data/app.db');
  if (dbPath.includes(':memory:')) {
    throw new Error('DB_PATH must point to a file: in-memory database is not allowed');
  }
  return dbPath;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: readPositiveInt(env, 'PORT', 3000),
    dbPath: readDbPath(env),
    cmcBaseUrl: readString(env, 'CMC_BASE_URL', 'https://pro-api.coinmarketcap.com'),
    httpTimeoutMs: readPositiveInt(env, 'HTTP_TIMEOUT_MS', 5000),
    syncIntervalMs: readPositiveInt(env, 'SYNC_INTERVAL_MS', 300000),
    bootstrapApiKey: readString(env, 'BOOTSTRAP_API_KEY'),
    cmcApiKey: readString(env, 'CMC_API_KEY'),
  };
}
