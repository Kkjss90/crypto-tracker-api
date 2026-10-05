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

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

    consoleMethod[level](formattedMessage, ...meta);
  }
}
