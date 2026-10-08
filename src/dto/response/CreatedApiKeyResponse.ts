import {ApiKeyResponse} from "./ApiKeyResponse";

export interface CreatedApiKeyResponse extends ApiKeyResponse {
  key: string;
}
