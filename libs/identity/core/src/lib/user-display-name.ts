import type { User } from './user.js';

/**
 * Derives the display name shown for a `User` across the platform: prefer
 * `firstName`, fall back to `username`, then to the durable `telegramId` so
 * every user always has a non-empty display name. Single source of truth —
 * both `SessionGuard` (`req.user.displayName`) and the CLI's `user:list`
 * must call this rather than re-deriving the fallback chain, so they can
 * never disagree.
 */
export function getUserDisplayName(user: User): string {
  return user.firstName ?? user.username ?? user.telegramId;
}
