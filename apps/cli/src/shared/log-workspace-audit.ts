import type pino from 'pino';

/** Every workspace membership mutation audited via {@link logWorkspaceAudit}. */
export type WorkspaceAuditAction =
  | 'workspace.create'
  | 'member.add'
  | 'member.set-role'
  | 'member.remove';

/** Fields logged for a single successful workspace membership mutation. */
export interface WorkspaceAuditFields {
  readonly action: WorkspaceAuditAction;
  readonly workspaceId: string;
  readonly userId: string;
  readonly telegramId: string;
  readonly role?: string;
}

/**
 * Emits exactly one structured audit log line for a successful workspace
 * membership mutation. Shared by every mutating `workspace:*` command so the
 * `action`/`by` field shape never drifts between them. Must be called only
 * on success — never on failure or a role-change no-op.
 */
export function logWorkspaceAudit(
  logger: pino.Logger,
  fields: WorkspaceAuditFields,
): void {
  logger.info({ ...fields, by: 'cli' }, `workspace audit: ${fields.action}`);
}
