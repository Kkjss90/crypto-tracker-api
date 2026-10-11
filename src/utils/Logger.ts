type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const consoleMethod: Record<Level, (...args: any[]) => void> = {
  trace: console.debug?.bind(console) ?? console.log,
  debug: console.debug?.bind(console) ?? console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

export class Logger {
  private static isProduction = process.env.NODE_ENV === 'production';
  private static formatTime: (date: Date) => string = (date) => date.toISOString();

  static setTimeFormatter(formatter: (date: Date) => string): void {
    this.formatTime = formatter;
  }

  static info(message: string, ...meta: any[]) {
    this.log('info', message, meta);
  }

  static warn(message: string, ...meta: any[]) {
    this.log('warn', message, meta);
  }

  static error(message: string, ...meta: any[]) {
    this.log('error', message, meta);
  }

  static debug(message: string, ...meta: any[]) {
    this.log('debug', message, meta);
  }

  static trace(message: string, ...meta: any[]) {
    this.log('trace', message, meta);
  }

  private static log(level: Level, message: string, meta: any[]) {
    if (this.isProduction && (level === 'trace' || level === 'debug')) return;

    const timestamp = this.formatTime(new Date());
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

    consoleMethod[level](formattedMessage, ...meta);
  }
}
