import { describe, expect, it, vi } from 'vitest';

import { Account } from 'budget-core';
import type { IAccountRepository } from 'budget-core';

import { resolveDefaultAccount } from './resolve-default-account.js';

describe('resolveDefaultAccount', () => {
  it('delegates to the repository\'s atomic findOrCreateDefault with the fixed "Main" name', async () => {
    const account = Account.create('acc-1', 'ws-1', 'Main', 'UAH');
    const accountRepository: IAccountRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByWorkspace: vi.fn(),
      findByIdInWorkspace: vi.fn(),
      findOrCreateDefault: vi.fn().mockResolvedValue(account),
    };

    const result = await resolveDefaultAccount(
      accountRepository,
      'ws-1',
      'UAH',
    );

    expect(result).toBe(account);
    expect(accountRepository.findOrCreateDefault).toHaveBeenCalledWith(
      'ws-1',
      'Main',
      'UAH',
    );
  });
});
