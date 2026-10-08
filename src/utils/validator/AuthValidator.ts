import {RegisterRequest} from "../../dto/request/RegisterRequest";
import {requireObject, throwIfIssues, unknownFieldIssues, ValidationIssue} from "./BasicValidation";
import {CreateApiKeyRequest} from "../../dto/request/CreateApiKeyRequest";
import {MAX_API_KEY_TTL_DAYS} from "../ApiKeyConstValues";

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
const KEY_NAME_MAX_LENGTH = 50;
const DEFAULT_KEY_NAME = 'api-key';

export function validateRegister(body: unknown): RegisterRequest {
  const data = requireObject(body);
  const issues: ValidationIssue[] = unknownFieldIssues(data, ['username']);

  let username = '';
  if (typeof data.username !== 'string') {
    issues.push({field: 'username', message: 'is required and must be a string'});
  } else {
    username = data.username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      issues.push({field: 'username', message: 'must be 3-32 characters: latin letters, digits or underscore'});
    }
  }

  throwIfIssues(issues);
  return {username};
}

export function validateCreateApiKey(body: unknown): CreateApiKeyRequest {
  const data: Record<string, unknown> = body === undefined ? {} : requireObject(body);
  const issues: ValidationIssue[] = unknownFieldIssues(data, ['name', 'expiresInDays']);

  let name = DEFAULT_KEY_NAME;
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      issues.push({field: 'name', message: 'must be a string'});
    } else {
      name = data.name.trim();
      if (name.length === 0 || name.length > KEY_NAME_MAX_LENGTH) {
        issues.push({field: 'name', message: `must be 1-${KEY_NAME_MAX_LENGTH} characters`});
      }
    }
  }

  let expiresInDays: number | undefined;
  if (data.expiresInDays !== undefined) {
    const value = data.expiresInDays;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_API_KEY_TTL_DAYS) {
      issues.push({field: 'expiresInDays', message: `must be an integer between 1 and ${MAX_API_KEY_TTL_DAYS}`});
    } else {
      expiresInDays = value;
    }
  }

  throwIfIssues(issues);
  return {name, expiresInDays};
}
