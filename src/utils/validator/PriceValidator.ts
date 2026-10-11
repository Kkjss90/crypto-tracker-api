import {isPlainObject, readInteger, readSingleValue, throwIfIssues, unknownFieldIssues} from "./BasicValidation";
import type {ValidationIssue} from "./BasicValidation";
import {HistoryQuery, SortOrder} from "../../model/PricePoint";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_OFFSET = 1_000_000;
const MIN_YEAR = 1970;
const MAX_YEAR = 2200;

const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

function parseTimestamp(raw: string): Date | undefined {
  if (!TIMESTAMP_PATTERN.test(raw)) return undefined;

  const [year, month, day] = raw.slice(0, 10).split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const calendarIsValid =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  if (!calendarIsValid) return undefined;

  const date = new Date(raw);
  const utcYear = date.getUTCFullYear();
  if (Number.isNaN(date.getTime()) || utcYear < MIN_YEAR || utcYear > MAX_YEAR) return undefined;

  return date;
}



function readTimestamp(query: Record<string, unknown>, field: string, issues: ValidationIssue[]): Date | undefined {
  const raw = readSingleValue(query, field, issues);
  if (raw === undefined) return undefined;

  const date = parseTimestamp(raw);
  if (!date) {
    issues.push({
      field,
      message: `must be an ISO 8601 date-time with timezone, e.g. 2026-10-07T10:00:00Z (years ${MIN_YEAR}-${MAX_YEAR})`,
    });
  }
  return date;
}

export function validateHistoryQuery(query: unknown): HistoryQuery {
  const data: Record<string, unknown> = isPlainObject(query) ? query : {};
  const issues: ValidationIssue[] = unknownFieldIssues(data, ['from', 'to', 'limit', 'offset', 'order']);

  const from = readTimestamp(data, 'from', issues);
  const to = readTimestamp(data, 'to', issues);
  const limit = readInteger(data, 'limit', {min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT}, issues);
  const offset = readInteger(data, 'offset', {min: 0, max: MAX_OFFSET, fallback: 0}, issues);

  let order: SortOrder = 'desc';
  const rawOrder = readSingleValue(data, 'order', issues);
  if (rawOrder !== undefined) {
    if (rawOrder === 'asc' || rawOrder === 'desc') {
      order = rawOrder;
    } else {
      issues.push({field: 'order', message: 'must be "asc" or "desc"'});
    }
  }

  if (from && to && from.getTime() > to.getTime()) {
    issues.push({field: 'from', message: 'must not be later than "to"'});
  }

  throwIfIssues(issues);
  return {from, to, limit, offset, order};
}
