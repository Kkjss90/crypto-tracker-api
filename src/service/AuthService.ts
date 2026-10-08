import {withTransaction} from "../database/Transaction";
import {Principal} from "../model/Principal";
import {ApiKey} from "../model/ApiKey";
import {User} from "../model/User";
import {UsersRepository} from "../repository/UsersRepository";
import {ApiKeyRepository} from "../repository/ApiKeyRepository";
import {Db} from "../database/Connection";
import {hashApiKey} from "../utils/Hash";
import {Logger} from "../utils/Logger";
import {isUniqueConstraintError} from "../error/UniqueConstraintError";
import {ConflictError} from "../error/ConflictError";
import {NotFoundError} from "../error/NotFoundError";
import {generateApiKey, keyPrefix} from "../utils/ApiKey";
import {MS_PER_DAY} from "../utils/ApiKeyConstValues";

const SYSTEM_USERNAME = 'system';
const BOOTSTRAP_KEY_NAME = 'bootstrap';
const DEFAULT_KEY_NAME = 'default';

export type AuthResult =
  | { ok: true; principal: Principal }
  | { ok: false; reason: 'unknown key' | 'expired key' };

export interface IssuedKey {
  apiKey: ApiKey;
  rawKey: string;
}

export interface Registration extends IssuedKey {
  user: User;
}

export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly keys: ApiKeyRepository,
    private readonly db: Db,
    private readonly defaultTtlDays: number,
  ) {
  }

  authenticate(token: string): AuthResult {
    const credential = this.keys.findCredentialByHash(hashApiKey(token));

    if (!credential) {
      return {ok: false, reason: 'unknown key'};
    }
    if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
      return {ok: false, reason: 'expired key'};
    }
    return {ok: true, principal: credential.principal};
  }

  register(username: string): Registration {
    try {
      const registration = withTransaction(this.db, () => {
        const user = this.users.create(username);
        return {user, ...this.issueKey(user.id, DEFAULT_KEY_NAME, this.defaultTtlDays)};
      });
      Logger.info('User registered', {userId: registration.user.id, username});
      return registration;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(`Username ${username} is already taken`);
      }
      throw error;
    }
  }

  listKeys(userId: number): ApiKey[] {
    return this.keys.findByUserId(userId);
  }

  createKey(userId: number, name: string, expiresInDays?: number): IssuedKey {
    const issued = this.issueKey(userId, name, expiresInDays ?? this.defaultTtlDays);
    Logger.info('API key created', {userId, keyId: issued.apiKey.id});
    return issued;
  }

  revokeKey(userId: number, keyId: number): void {
    withTransaction(this.db, () => {
      const key = this.keys.findByIdAndUser(keyId, userId);
      if (!key) {
        throw new NotFoundError(`API key ${keyId} not found`);
      }

      const now = new Date();
      const isActive = key.expiresAt === null || key.expiresAt.getTime() > now.getTime();
      if (isActive && this.keys.countActiveByUserId(userId, now) <= 1) {
        throw new ConflictError('Cannot revoke the last active API key');
      }

      this.keys.delete(keyId, userId);
    });
    Logger.info('API key revoked', {userId, keyId});
  }

  ensureBootstrapKey(rawKey: string): void {
    withTransaction(this.db, () => {
      const user = this.users.findByUsername(SYSTEM_USERNAME) ?? this.users.create(SYSTEM_USERNAME);
      const keyHash = hashApiKey(rawKey);

      if (!this.keys.findCredentialByHash(keyHash)) {
        this.keys.create({
          userId: user.id,
          name: BOOTSTRAP_KEY_NAME,
          prefix: 'env',
          keyHash,
          expiresAt: null,
        });
        Logger.info('Bootstrap API key created');
      }
      this.keys.deleteByNameExcept(user.id, BOOTSTRAP_KEY_NAME, keyHash);
    });
  }

  private issueKey(userId: number, name: string, ttlDays: number): IssuedKey {
    const rawKey = generateApiKey();
    const apiKey = this.keys.create({
      userId,
      name,
      prefix: keyPrefix(rawKey),
      keyHash: hashApiKey(rawKey),
      expiresAt: new Date(Date.now() + ttlDays * MS_PER_DAY),
    });
    return {apiKey, rawKey};
  }
}

export function createAuthService(db: Db, defaultTtlDays: number): AuthService {
  return new AuthService(new UsersRepository(db), new ApiKeyRepository(db), db, defaultTtlDays);
}
