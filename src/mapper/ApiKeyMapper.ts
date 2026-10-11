import {ApiKey} from "../model/ApiKey";
import {ApiKeyEntity} from "../entity/ApiKeyEntity";
import {ApiKeyResponse} from "../dto/response/ApiKeyResponse";
import {CreatedApiKeyResponse} from "../dto/response/CreatedApiKeyResponse";
import {TimeFormatter} from "../utils/Time";

export function toApiKey(entity: ApiKeyEntity): ApiKey {
  return {
    id: entity.id,
    userId: entity.user_id,
    name: entity.name,
    prefix: entity.key_prefix,
    createdAt: new Date(entity.created_at),
    expiresAt: entity.expires_at ? new Date(entity.expires_at) : null,
  };
}

export function toApiKeyResponse(apiKey: ApiKey, formatTime: TimeFormatter, now: Date = new Date()): ApiKeyResponse {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    createdAt: formatTime(apiKey.createdAt),
    expiresAt: apiKey.expiresAt ? formatTime(apiKey.expiresAt) : null,
    expired: apiKey.expiresAt !== null && apiKey.expiresAt.getTime() <= now.getTime(),
  };
}

export function toCreatedApiKeyResponse(apiKey: ApiKey, rawKey: string, formatTime: TimeFormatter): CreatedApiKeyResponse {
  return { ...toApiKeyResponse(apiKey, formatTime), key: rawKey };
}
