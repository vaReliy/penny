import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { NotFoundError } from 'shared-errors';

import { printCliError } from './print-cli-error.js';

describe('printCliError', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    logger = pino({ level: 'silent' });
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs "<CODE>: <message>" and exits 1 for a BaseError', () => {
    printCliError(
      new NotFoundError('User with Telegram ID 1 not found'),
      logger,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'NOT_FOUND_ERROR: User with Telegram ID 1 not found',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs a generic message and exits 1 for an unrecognized error', () => {
    printCliError(new Error('boom'), logger);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
