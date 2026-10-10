import {MAX_API_KEY_TTL_DAYS} from "../utils/ApiKeyConstValues";

const MIN_SYNC_INTERVAL_MS = 60000;

export interface Config {
  port: number;
  dbPath: string;
  cmcBaseUrl: string;
  httpTimeoutMs: number;
  syncIntervalMs: number;
  bootstrapApiKey: string;
  cmcApiKey: string;
  bootstrapApiKeyTtlDays: number;
  shutdownTimeoutMs: number;
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

function readApiKeyTtlDays(env: NodeJS.ProcessEnv): number {
  const days = readPositiveInt(env, 'BOOTSTRAP_API_KEY_TTL_DAYS', 90);
  if (days > MAX_API_KEY_TTL_DAYS) {
    throw new Error(`Env variable BOOTSTRAP_API_KEY_TTL_DAYS must not exceed ${MAX_API_KEY_TTL_DAYS}`);
  }
  return days;
}

function readSyncInterval(env: NodeJS.ProcessEnv): number {
  const ms = readPositiveInt(env, 'SYNC_INTERVAL_MS', 300000);
  if (ms < MIN_SYNC_INTERVAL_MS) {
    throw new Error(`Env variable SYNC_INTERVAL_MS must be at least ${MIN_SYNC_INTERVAL_MS}`);
  }
  return ms;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: readPositiveInt(env, 'PORT', 3000),
    dbPath: readDbPath(env),
    cmcBaseUrl: readString(env, 'CMC_BASE_URL', 'https://pro-api.coinmarketcap.com'),
    httpTimeoutMs: readPositiveInt(env, 'HTTP_TIMEOUT_MS', 5000),
    syncIntervalMs: readSyncInterval(env),
    bootstrapApiKey: readString(env, 'BOOTSTRAP_API_KEY'),
    cmcApiKey: readString(env, 'CMC_API_KEY'),
    bootstrapApiKeyTtlDays: readApiKeyTtlDays(env),
    shutdownTimeoutMs: readPositiveInt(env, 'SHUTDOWN_TIMEOUT_MS', 8000),
  };
}
