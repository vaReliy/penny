import pino from 'pino';

/**
 * Configuration for the Pino logger.
 * Passed explicitly by the interface layer (never read from `process.env` inside libs).
 */
export interface PinoLoggerConfig {
  /**
   * Environment mode: 'production' or 'development'.
   * Controls output format: JSON in prod, human-readable with pino-pretty in dev.
   */
  readonly mode: 'production' | 'development';
  /**
   * When true, pino-pretty runs in the main thread as a synchronous stream
   * instead of a worker-thread transport. Required for CLI commands that call
   * process.exit() — the async worker is killed before it can flush otherwise.
   */
  readonly sync?: boolean;
}

/**
 * Factory function to create a Pino logger instance.
 * In development, uses pino-pretty for readable output.
 * In production, outputs compact JSON.
 *
 * @param config - Logger configuration (mode: 'production' or 'development')
 * @returns A configured Pino logger instance
 */
export function createPinoLogger(config: PinoLoggerConfig): pino.Logger {
  if (config.mode === 'development') {
    if (config.sync) {
      // Synchronous main-thread stream — safe for CLI commands that call process.exit().
      // Dynamic require keeps pino-pretty out of the production bundle (it is a devDependency).
      const pretty = require('pino-pretty') as (
        opts: Record<string, unknown>,
      ) => NodeJS.WritableStream;
      return pino(
        { level: 'debug' },
        pretty({
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          sync: true,
        }),
      );
    }

    return pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  // Production: compact JSON (no transport overhead)
  return pino({
    level: 'info',
  });
}
