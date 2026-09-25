import type { IUserRepository, User } from 'identity-core';
import { NotFoundError } from 'shared-errors';

/**
 * Resolves the `User` for `telegramId`, or throws `NotFoundError` with a
 * message that every `--telegram-id` CLI command surfaces verbatim via
 * `printCliError`. Single source of truth so `admin:promote`,
 * `user:approve`, `user:reject` (and any future command keyed by Telegram
 * id) never drift on the resolution/error-message contract.
 */
export async function resolveUserByTelegramId(
  userRepository: IUserRepository,
  telegramId: string,
): Promise<User> {
  const user = await userRepository.findByTelegramId(telegramId);
  if (!user) {
    throw new NotFoundError(`User with Telegram ID ${telegramId} not found`);
  }
  return user;
}
