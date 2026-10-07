import {ApiKeyEntity} from "../entity/ApiKeyEntity";
import {ApiKey} from "../model/ApiKey";

export function toApiKey(entity: ApiKeyEntity): ApiKey {
  return {
    id: entity.id,
    name: entity.name,
    createdAt: new Date(entity.created_at),
    expiresAt: new Date(entity.expires_at),
  };
}
