export type TimeFormatter = (date: Date) => string;

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

export function resolveTimeZone(name: string): string {
  return new Intl.DateTimeFormat('en-US', {timeZone: name}).resolvedOptions().timeZone;
}

export function createTimeFormatter(timeZone: string): TimeFormatter {
  if (timeZone === 'UTC') {
    return (date) => date.toISOString();
  }

  const wallClock = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (date) => {
    const p: Record<string, string> = {};
    for (const part of wallClock.formatToParts(date)) {
      p[part.type] = part.value;
    }

    const ms = date.getUTCMilliseconds();
    const wallAsUtc = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour), Number(p.minute), Number(p.second), ms,
    );
    const offsetMinutes = Math.round((wallAsUtc - date.getTime()) / 60_000);
    const sign = offsetMinutes < 0 ? '-' : '+';
    const abs = Math.abs(offsetMinutes);

    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${pad(ms, 3)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  };
}
