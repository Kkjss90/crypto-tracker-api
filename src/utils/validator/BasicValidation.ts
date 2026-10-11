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

export function readSingleValue(query: Record<string, unknown>, field: string, issues: ValidationIssue[]): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    issues.push({field, message: 'must be a single value'});
    return undefined;
  }
  return value;
}

export function readInteger(
  query: Record<string, unknown>,
  field: string,
  limits: { min: number; max: number; fallback: number },
  issues: ValidationIssue[],
): number {
  const raw = readSingleValue(query, field, issues);
  if (raw === undefined) return limits.fallback;

  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < limits.min || value > limits.max) {
    issues.push({field, message: `must be an integer between ${limits.min} and ${limits.max}`});
    return limits.fallback;
  }
  return value;
}
