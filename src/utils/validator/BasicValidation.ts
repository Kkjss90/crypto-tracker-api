import {ValidationError} from "../../error/ValidationError";

export interface ValidationIssue {
  field: string;
  message: string;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function unknownFieldIssues(body: Record<string, unknown>, allowed: string[]): ValidationIssue[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((key) => ({field: key, message: 'unknown field'}));
}

export function throwIfIssues(issues: ValidationIssue[]): void {
  if (issues.length > 0) {
    throw new ValidationError('Validation failed', issues);
  }
}

export function parseId(raw: unknown): number {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new ValidationError('Validation failed', [{field: 'id', message: 'must be a positive integer'}]);
  }
  return Number(raw);
}

export function requireObject(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) {
    throw new ValidationError('Validation failed', [{field: 'body', message: 'must be a JSON object'}]);
  }
  return body;
}
