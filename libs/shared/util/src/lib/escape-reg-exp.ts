/**
 * Escapes every RegExp special character in `value` so it can be embedded
 * literally inside a `RegExp` (e.g. a user-typed substring used in a
 * database `$regex` filter). Without this, input like `.*` would be
 * interpreted as a wildcard rather than matched literally.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
