import { vi } from 'vitest';
import type { IUserRepository } from 'identity-core';

/**
 * Creates a fully-typed fake `IUserRepository` implementation with all methods
 * stubbed to sensible defaults. Caller can override specific methods by passing
 * an `overrides` object.
 *
 * @param overrides - Optional partial `IUserRepository` to override default stubs.
 * @returns A complete fake repository ready for test injection.
 */
export function createFakeUserRepository(
  overrides?: Partial<IUserRepository>,
): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByTelegramId: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(null),
    updateRoles: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}
