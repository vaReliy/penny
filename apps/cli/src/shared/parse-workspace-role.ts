import { WorkspaceMemberRole } from 'workspace-core';
import type { WorkspaceMemberRoleType } from 'workspace-core';
import { ValidationError } from 'shared-errors';

import { printCliError } from './print-cli-error.js';

import type pino from 'pino';

/** Every valid `--role` value, used both for validation and error messages. */
const VALID_ROLES = Object.values(WorkspaceMemberRole);

/**
 * Validates a raw `--role` CLI option value, exiting via `printCliError` on
 * an unrecognized value. Shared by `workspace:add-member` (optional) and
 * `workspace:set-role` (required) so the error format never drifts between
 * the two commands.
 */
export function parseWorkspaceRole(
  val: string,
  logger: pino.Logger,
): WorkspaceMemberRoleType {
  if (!VALID_ROLES.includes(val as WorkspaceMemberRoleType)) {
    printCliError(
      new ValidationError(
        `Invalid role "${val}". Must be one of: ${VALID_ROLES.join(', ')}`,
      ),
      logger,
    );
  }
  return val as WorkspaceMemberRoleType;
}
