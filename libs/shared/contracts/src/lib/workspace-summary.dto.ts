/**
 * One entry of `GET /api/workspaces`: a workspace the caller belongs to and
 * the caller's own role in it. Types-only — no logic.
 */
export interface WorkspaceSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly role: 'admin' | 'member';
  /** When the caller was granted membership, ISO-8601. */
  readonly grantedAt: string;
}
