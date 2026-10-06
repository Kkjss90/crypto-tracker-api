import {isPlainObject, throwIfIssues, unknownFieldIssues, ValidationIssue} from "./BasicValidation";
import {ValidationError} from "../../error/ValidationError";
import {CreateCoinRequest} from "../../dto/request/CreateCoinRequest";
import {UpdateCoinRequest} from "../../dto/request/UpdateCoinRequest";


const SYMBOL_PATTERN = /^[A-Z0-9]{1,20}$/;
const NAME_MAX_LENGTH = 100;

function requireObject(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) {
    throw new ValidationError('Validation failed', [{ field: 'body', message: 'must be a JSON object' }]);
  }
  return body;
}

export function validateCreateCoin(body: unknown): CreateCoinRequest {
  const data = requireObject(body);
  const issues: ValidationIssue[] = unknownFieldIssues(data, ['symbol']);

  let symbol = '';
  if (typeof data.symbol !== 'string') {
    issues.push({ field: 'symbol', message: 'is required and must be a string' });
  } else {
    symbol = data.symbol.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
      issues.push({ field: 'symbol', message: 'must be 1-20 latin letters or digits' });
    }
  }

  throwIfIssues(issues);
  return { symbol };
}

export function validateUpdateCoin(body: unknown): UpdateCoinRequest {
  const data = requireObject(body);
  const issues: ValidationIssue[] = unknownFieldIssues(data, ['name']);

  let name = '';
  if (typeof data.name !== 'string') {
    issues.push({ field: 'name', message: 'is required and must be a string' });
  } else {
    name = data.name.trim();
    if (name.length === 0 || name.length > NAME_MAX_LENGTH) {
      issues.push({ field: 'name', message: `must be 1-${NAME_MAX_LENGTH} characters` });
    }
  }

  throwIfIssues(issues);
  return { name };
}
