import type pino from 'pino';

import { BaseError } from 'shared-errors';

/** Generic message logged for an error that isn't a recognized `BaseError`. */
const UNKNOWN_ERROR_MESSAGE = 'An unexpected error occurred.';

/**
 * Logs `error` via the injected pino `logger` and exits the process with
 * code 1. A `BaseError`-family error is logged as `<code>: <message>` using
 * its stable `code`; anything else is logged as a generic message. Shared
 * by every CLI command's catch block so error presentation never drifts
 * between commands.
 */
export function printCliError(error: unknown, logger: pino.Logger): never {
  if (error instanceof BaseError) {
    logger.error(`${error.code}: ${error.message}`);
  } else {
    logger.error({ err: error }, UNKNOWN_ERROR_MESSAGE);
  }
  process.exit(1);
}
