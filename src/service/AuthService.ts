import {ApiKeyRepository} from "../repository/ApiKeyRepository";
import {ApiKey} from "../model/ApiKey";
import {hashApiKey} from "../utils/Hash";
import {Logger} from "../utils/Logger";
import {isUniqueConstraintError} from "../utils/UniqConstriantValidation";

export class AuthService {
  constructor(private readonly keys: ApiKeyRepository) {
  }

  authenticate(token: string): ApiKey | undefined {
    return this.keys.findByHash(hashApiKey(token));
  }

  ensureKey(name: string, rawKey: string): void {
    const hash = hashApiKey(rawKey);
    if (this.keys.findByHash(hash)) return;

    try {
      this.keys.create(name, hash);
      Logger.info('API key created', {name});
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
}
