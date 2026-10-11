import {createTimeFormatter, resolveTimeZone} from '../src/utils/Time';

describe('createTimeFormatter', () => {
  const at = (iso: string) => new Date(iso);

  it('UTC даёт обычный ISO со знаком Z', () => {
    expect(createTimeFormatter('UTC')(at('2026-10-07T10:00:00.123Z'))).toBe('2026-10-07T10:00:00.123Z');
  });

  it.each([
    ['Europe/Moscow', '2026-10-07T10:00:00.123Z', '2026-10-07T13:00:00.123+03:00'],
    ['Europe/Moscow', '2026-10-07T21:30:00.000Z', '2026-10-08T00:30:00.000+03:00'],
    ['Europe/Berlin', '2026-07-01T10:00:00.000Z', '2026-07-01T12:00:00.000+02:00'],
    ['Europe/Berlin', '2026-12-01T10:00:00.000Z', '2026-12-01T11:00:00.000+01:00'],
    ['Asia/Kolkata', '2026-10-07T10:00:00.000Z', '2026-10-07T15:30:00.000+05:30'],
    ['America/New_York', '2026-01-15T12:00:00.000Z', '2026-01-15T07:00:00.000-05:00'],
  ])('%s: %s -> %s', (zone, utc, expected) => {
    expect(createTimeFormatter(zone)(at(utc))).toBe(expected);
  });

  it('результат описывает тот же момент времени', () => {
    const format = createTimeFormatter('Asia/Kolkata');
    const date = at('2026-03-29T01:59:59.999Z');

    expect(new Date(format(date)).getTime()).toBe(date.getTime());
  });
});

describe('resolveTimeZone', () => {
  it('приводит имя к каноническому виду', () => {
    expect(resolveTimeZone('europe/moscow')).toBe('Europe/Moscow');
    expect(resolveTimeZone('utc')).toBe('UTC');
  });

  it('отвергает неизвестное имя', () => {
    expect(() => resolveTimeZone('Mars/Olympus')).toThrow();
  });
});
