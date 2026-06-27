import type { LoggerService, LogLevel } from '@nestjs/common';
import type pino from 'pino';

const NEST_TO_PINO_LEVEL: Record<LogLevel, pino.Level> = {
  log: 'info',
  error: 'error',
  warn: 'warn',
  debug: 'debug',
  verbose: 'trace',
  fatal: 'fatal',
};

const PINO_LEVEL_VALUE: Record<pino.Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Adapts a pino logger to the NestJS `LoggerService` interface so that all
 * framework lifecycle and filter logs flow through the same pino root instance
 * used by `pino-http`.  Keeps a single log stream and consistent JSON format.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: pino.Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }

  setLogLevels(levels: LogLevel[]): void {
    if (levels.length === 0) return;

    const pinoLevels = levels.map((l) => NEST_TO_PINO_LEVEL[l]);
    const lowest = pinoLevels.reduce((min, l) =>
      PINO_LEVEL_VALUE[l] < PINO_LEVEL_VALUE[min] ? l : min,
    );

    this.logger.level = lowest;
  }
}
