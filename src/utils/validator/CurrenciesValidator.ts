import {CurrencyQuery} from "../../model/Currency";
import {
  isPlainObject,
  readInteger,
  readSingleValue,
  throwIfIssues,
  unknownFieldIssues,
  ValidationIssue
} from "./BasicValidation";

export function validateCurrencyQuery(query: unknown): CurrencyQuery {
  const data: Record<string, unknown> = isPlainObject(query) ? query : {};
  const issues: ValidationIssue[] = unknownFieldIssues(data, ['search', 'limit', 'offset']);

  let search: string | undefined;
  const raw = readSingleValue(data, 'search', issues);
  if (raw !== undefined) {
    const trimmed = raw.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      issues.push({ field: 'search', message: 'must be 1-50 characters' });
    } else {
      search = trimmed;
    }
  }

  const limit = readInteger(data, 'limit', { min: 1, max: 500, fallback: 100 }, issues);
  const offset = readInteger(data, 'offset', { min: 0, max: 1_000_000, fallback: 0 }, issues);

  throwIfIssues(issues);
  return { search, limit, offset };
}
