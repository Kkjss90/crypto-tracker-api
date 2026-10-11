import {Logger} from "../utils/Logger";

export interface PeriodicTaskOptions {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
  onError: (error: unknown) => void;
}

export class PeriodicTask {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private started = false;
  private stopRequested = false;
  private stopPromise: Promise<void> | null = null;

  constructor(private readonly options: PeriodicTaskOptions) {}

  start(): void {
    if (this.started || this.stopRequested) {
      Logger.warn('Background task was already started or stopped, ignoring start()', { task: this.options.name });
      return;
    }
    this.started = true;
    Logger.info('Background task started', { task: this.options.name, intervalMs: this.options.intervalMs });
    this.schedule(0);
  }

  stop(): Promise<void> {
    this.stopRequested = true;
    this.stopPromise ??= this.drain();
    return this.stopPromise;
  }

  private schedule(delayMs: number): void {
    if (this.stopRequested) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      this.running = this.tick().finally(() => {
        this.running = null;
        this.schedule(this.options.intervalMs);
      });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    try {
      await this.options.run();
    } catch (error) {
      try {
        this.options.onError(error);
      } catch (handlerError) {
        Logger.error('Background task error handler failed', handlerError);
      }
    }
  }

  private async drain(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.running;
    Logger.info('Background task stopped', { task: this.options.name });
  }
}
