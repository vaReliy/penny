import type { DocumentType } from '@typegoose/typegoose';
import { describe, expect, it } from 'vitest';

import { Account } from 'budget-core';

import { AccountMapper } from './account.mapper.js';
import type { AccountModel } from './account.model.js';

/** Minimal hydrated-document shape `AccountMapper.toDomain` reads from. */
function buildDoc(createdAt: Date): DocumentType<AccountModel> {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    workspaceId: 'ws-1',
    name: 'Main',
    currency: 'UAH',
    createdAt,
  } as unknown as DocumentType<AccountModel>;
}

describe('AccountMapper', () => {
  describe('toDomain', () => {
    it('maps a hydrated document to a domain Account, preserving the exact createdAt', () => {
      const createdAt = new Date('2026-06-15T12:00:00.000Z');

      const account = AccountMapper.toDomain(buildDoc(createdAt));

      expect(account).toBeInstanceOf(Account);
      expect(account.id).toBe('507f1f77bcf86cd799439011');
      expect(account.workspaceId).toBe('ws-1');
      expect(account.name).toBe('Main');
      expect(account.currency).toBe('UAH');
      expect(account.createdAt).toEqual(createdAt);
    });
  });

  describe('toPersistence', () => {
    it('carries workspaceId, name, currency, and createdAt', () => {
      const createdAt = new Date('2026-06-15T12:00:00.000Z');
      const account = Account.create('acc-1', 'ws-1', 'Main', 'UAH', createdAt);

      const persistence = AccountMapper.toPersistence(account);

      expect(persistence).toEqual({
        workspaceId: 'ws-1',
        name: 'Main',
        currency: 'UAH',
        createdAt,
      });
    });
  });
});
