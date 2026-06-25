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
    return pino({
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
