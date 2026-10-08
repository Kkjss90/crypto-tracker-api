import {CreatedApiKeyResponse} from "./CreatedApiKeyResponse";
import {UserResponse} from "./UserResponse";

export interface RegisterResponse {
  user: UserResponse;
  apiKey: CreatedApiKeyResponse;
}
