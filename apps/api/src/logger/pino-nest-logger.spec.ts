import { describe, it, expect, vi, beforeEach } from 'vitest';
import type pino from 'pino';
import { PinoNestLogger } from './pino-nest-logger.js';

type PinoLevelFn = ReturnType<typeof vi.fn>;

interface MockPinoLogger {
  info: PinoLevelFn;
  error: PinoLevelFn;
  warn: PinoLevelFn;
  debug: PinoLevelFn;
  trace: PinoLevelFn;
  fatal: PinoLevelFn;
  level: string;
}

function buildMock(): MockPinoLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    level: 'info',
  };
}

describe('PinoNestLogger', () => {
  let mock: MockPinoLogger;
  let adapter: PinoNestLogger;

  beforeEach(() => {
    mock = buildMock();
    adapter = new PinoNestLogger(mock as unknown as pino.Logger);
  });

  describe('log()', () => {
    it('delegates to pino.info with context object and message', () => {
      adapter.log('hello world', 'AppModule');

      expect(mock.info).toHaveBeenCalledOnce();
      expect(mock.info).toHaveBeenCalledWith(
        { context: 'AppModule' },
        'hello world',
      );
    });

    it('delegates to pino.info when context is omitted', () => {
      adapter.log('hello world');

      expect(mock.info).toHaveBeenCalledOnce();
      expect(mock.info).toHaveBeenCalledWith(
        { context: undefined },
        'hello world',
      );
    });
  });

  describe('error()', () => {
    it('delegates to pino.error with context, trace, and message', () => {
      adapter.error(
        'something broke',
        'Error: stack\n  at foo',
        'ErrorHandler',
      );

      expect(mock.error).toHaveBeenCalledOnce();
      expect(mock.error).toHaveBeenCalledWith(
        { context: 'ErrorHandler', trace: 'Error: stack\n  at foo' },
        'something broke',
      );
    });

    it('delegates to pino.error with undefined trace when omitted', () => {
      adapter.error('something broke', undefined, 'ErrorHandler');

      expect(mock.error).toHaveBeenCalledOnce();
      expect(mock.error).toHaveBeenCalledWith(
        { context: 'ErrorHandler', trace: undefined },
        'something broke',
      );
    });

    it('delegates to pino.error when context and trace are omitted', () => {
      adapter.error('something broke');

      expect(mock.error).toHaveBeenCalledOnce();
      expect(mock.error).toHaveBeenCalledWith(
        { context: undefined, trace: undefined },
        'something broke',
      );
    });
  });

  describe('warn()', () => {
    it('delegates to pino.warn with context object and message', () => {
      adapter.warn('be careful', 'BootstrapModule');

      expect(mock.warn).toHaveBeenCalledOnce();
      expect(mock.warn).toHaveBeenCalledWith(
        { context: 'BootstrapModule' },
        'be careful',
      );
    });

    it('delegates to pino.warn when context is omitted', () => {
      adapter.warn('be careful');

      expect(mock.warn).toHaveBeenCalledOnce();
      expect(mock.warn).toHaveBeenCalledWith(
        { context: undefined },
        'be careful',
      );
    });
  });

  describe('debug()', () => {
    it('delegates to pino.debug with context object and message', () => {
      adapter.debug('debug info', 'DbService');

      expect(mock.debug).toHaveBeenCalledOnce();
      expect(mock.debug).toHaveBeenCalledWith(
        { context: 'DbService' },
        'debug info',
      );
    });

    it('delegates to pino.debug when context is omitted', () => {
      adapter.debug('debug info');

      expect(mock.debug).toHaveBeenCalledOnce();
      expect(mock.debug).toHaveBeenCalledWith(
        { context: undefined },
        'debug info',
      );
    });
  });

  describe('verbose()', () => {
    it('delegates to pino.trace with context object and message', () => {
      adapter.verbose('trace detail', 'RouterExplorer');

      expect(mock.trace).toHaveBeenCalledOnce();
      expect(mock.trace).toHaveBeenCalledWith(
        { context: 'RouterExplorer' },
        'trace detail',
      );
    });

    it('delegates to pino.trace when context is omitted', () => {
      adapter.verbose('trace detail');

      expect(mock.trace).toHaveBeenCalledOnce();
      expect(mock.trace).toHaveBeenCalledWith(
        { context: undefined },
        'trace detail',
      );
    });
  });

  describe('fatal()', () => {
    it('delegates to pino.fatal with context object and message', () => {
      adapter.fatal('unrecoverable error', 'ProcessSignal');

      expect(mock.fatal).toHaveBeenCalledOnce();
      expect(mock.fatal).toHaveBeenCalledWith(
        { context: 'ProcessSignal' },
        'unrecoverable error',
      );
    });

    it('delegates to pino.fatal when context is omitted', () => {
      adapter.fatal('unrecoverable error');

      expect(mock.fatal).toHaveBeenCalledOnce();
      expect(mock.fatal).toHaveBeenCalledWith(
        { context: undefined },
        'unrecoverable error',
      );
    });
  });

  describe('setLogLevels()', () => {
    it("sets logger.level to 'info' when called with ['log']", () => {
      adapter.setLogLevels(['log']);

      expect(mock.level).toBe('info');
    });

    it("sets logger.level to 'debug' (minimum) when called with ['debug', 'error']", () => {
      adapter.setLogLevels(['debug', 'error']);

      expect(mock.level).toBe('debug');
    });

    it("sets logger.level to 'trace' (minimum) when called with ['verbose', 'log', 'error']", () => {
      adapter.setLogLevels(['verbose', 'log', 'error']);

      expect(mock.level).toBe('trace');
    });

    it('leaves logger.level unchanged when called with an empty array', () => {
      mock.level = 'warn';

      adapter.setLogLevels([]);

      expect(mock.level).toBe('warn');
    });
  });

  describe('message coercion', () => {
    it('converts non-string message to string via log()', () => {
      adapter.log(42, 'NumericCtx');

      expect(mock.info).toHaveBeenCalledWith({ context: 'NumericCtx' }, '42');
    });

    it('converts object message to string via error()', () => {
      adapter.error({ code: 500 }, 'stack', 'ErrCtx');

      expect(mock.error).toHaveBeenCalledWith(
        { context: 'ErrCtx', trace: 'stack' },
        '[object Object]',
      );
    });
  });
});
