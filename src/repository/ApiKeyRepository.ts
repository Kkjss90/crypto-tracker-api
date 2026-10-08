import {Db} from "../database/Connection";
import {ApiKey} from "../model/ApiKey";
import {Principal} from "../model/Principal";
import {toApiKey} from "../mapper/ApiKeyMapper";
import {ApiKeyEntity} from "../entity/ApiKeyEntity";

export interface NewApiKey {
  userId: number;
  name: string;
  prefix: string;
  keyHash: string;
  expiresAt: Date | null;
}

export interface Credential {
  principal: Principal;
  expiresAt: Date | null;
}

const COLUMNS = 'id, user_id, key_hash, key_prefix, name, created_at, expires_at';

export class ApiKeyRepository {
  constructor(private readonly db: Db) {
  }

  create(key: NewApiKey): ApiKey {
    const createdAt = new Date();
    const result = this.db
      .prepare(
        `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        key.userId,
        key.keyHash,
        key.prefix,
        key.name,
        createdAt.toISOString(),
        key.expiresAt ? key.expiresAt.toISOString() : null,
      );

    return {
      id: Number(result.lastInsertRowid),
      userId: key.userId,
      name: key.name,
      prefix: key.prefix,
      createdAt,
      expiresAt: key.expiresAt,
    };
  }

  findCredentialByHash(keyHash: string): Credential | undefined {
    const row = this.db
      .prepare(
        `SELECT k.id AS key_id, k.expires_at, u.id AS user_id, u.username
         FROM api_keys k JOIN users u ON u.id = k.user_id
         WHERE k.key_hash = ?`,
      )
      .get(keyHash) as
      | { key_id: number; expires_at: string | null; user_id: number; username: string }
      | undefined;

    if (!row) return undefined;

    return {
      principal: {keyId: row.key_id, userId: row.user_id, username: row.username},
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    };
  }

  findByUserId(userId: number): ApiKey[] {
    return this.db
      .prepare(`SELECT ${COLUMNS} FROM api_keys WHERE user_id = ? ORDER BY id`)
      .all(userId)
      .map((row) => toApiKey(row as unknown as ApiKeyEntity));
  }

  findByIdAndUser(id: number, userId: number): ApiKey | undefined {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM api_keys WHERE id = ? AND user_id = ?`)
      .get(id, userId);

    return row ? toApiKey(row as unknown as ApiKeyEntity) : undefined;
  }

  countActiveByUserId(userId: number, now: Date): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)')
      .get(userId, now.toISOString()) as { n: number };

    return row.n;
  }

  delete(id: number, userId: number): boolean {
    const result = this.db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, userId);
    return Number(result.changes) > 0;
  }

  deleteByNameExcept(userId: number, name: string, keepHash: string): void {
    this.db
      .prepare('DELETE FROM api_keys WHERE user_id = ? AND name = ? AND key_hash != ?')
      .run(userId, name, keepHash);
  }
}
