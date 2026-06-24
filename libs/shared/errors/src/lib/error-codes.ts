/**
 * Stable, machine-readable error codes shared across the platform.
 * Codes are part of the public contract — never rename without a migration.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  DOMAIN_CONFLICT_ERROR: 'DOMAIN_CONFLICT_ERROR',
  DOMAIN_FORBIDDEN_ERROR: 'DOMAIN_FORBIDDEN_ERROR',
  DOMAIN_UNPROCESSABLE_ERROR: 'DOMAIN_UNPROCESSABLE_ERROR',
  INFRASTRUCTURE_ERROR: 'INFRASTRUCTURE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
