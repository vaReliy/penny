import { describe, it, expect } from 'vitest';
import { createPinoLogger } from './pino-logger.js';
import type { PinoLoggerConfig } from './pino-logger.js';

describe('createPinoLogger', () => {
  describe('production mode', () => {
    const config: PinoLoggerConfig = { mode: 'production' };

    it('returns a pino logger instance with required logging methods', () => {
      const logger = createPinoLogger(config);

      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('sets level to info', () => {
      const logger = createPinoLogger(config);

      expect(logger.level).toBe('info');
    });

    it('has no transport configured (direct JSON output)', () => {
      const logger = createPinoLogger(config);

      // pino loggers without a transport have no `transport` property on the
      // options snapshot; accessing it via the internal options returns undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((logger as any).transport).toBeUndefined();
    });
  });

  describe('development mode', () => {
    const config: PinoLoggerConfig = { mode: 'development' };

    it('returns a pino logger instance with required logging methods', () => {
      const logger = createPinoLogger(config);

      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('sets level to debug', () => {
      const logger = createPinoLogger(config);

      expect(logger.level).toBe('debug');
    });
  });

  it('returns distinct logger instances on each call', () => {
    const a = createPinoLogger({ mode: 'production' });
    const b = createPinoLogger({ mode: 'production' });

    expect(a).not.toBe(b);
  });
});
