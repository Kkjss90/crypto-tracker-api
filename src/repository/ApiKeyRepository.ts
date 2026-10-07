import {Db} from "../database/Connection";
import {ApiKey} from "../model/ApiKey";
import {toApiKey} from "../mapper/ApiKeyMapper";
import {ApiKeyEntity} from "../entity/ApiKeyEntity";

export class ApiKeyRepository {
  static readonly ONE_HOUR_IN_MS = 60 * 60 * 1000;
  static readonly TTL_JWT: number = 3 * ApiKeyRepository.ONE_HOUR_IN_MS;

  constructor(private readonly db: Db) {
  }

  create(name: string, keyHash: string): ApiKey {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ApiKeyRepository.TTL_JWT);
    const result = this.db
      .prepare('INSERT INTO api_keys (key_hash, name, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(keyHash, name, createdAt.toISOString(), expiresAt.toISOString());

    return {id: Number(result.lastInsertRowid), name, createdAt, expiresAt};
  }

  findByHash(keyHash: string): ApiKey | undefined {
    const row = this.db
      .prepare('SELECT id, key_hash, name, created_at, expires_at FROM api_keys WHERE key_hash = ? and expires_at > ?')
      .get(keyHash, new Date().toISOString());

    return row ? toApiKey(row as unknown as ApiKeyEntity) : undefined;
  }
}
