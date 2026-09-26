/**
 * Shared user-facing error messages. Single source of truth for text that
 * must stay byte-identical across bounded contexts that cannot import from
 * each other (e.g. `identity-application` and `workspace-application`).
 */
export const NOT_ADMIN_MESSAGE = 'Only an admin may approve or reject a user.';
