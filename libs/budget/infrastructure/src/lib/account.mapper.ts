import type { DocumentType } from '@typegoose/typegoose';

import { Account } from 'budget-core';

import type { AccountModel } from './account.model.js';

/**
 * Plain persistence shape accepted by {@link MongoAccountRepository} when
 * creating a document. Mirrors {@link AccountModel}'s own fields (minus
 * Mongoose/Typegoose machinery) so callers outside this file never need to
 * reference Mongoose types.
 */
export interface AccountPersistence {
  readonly workspaceId: string;
  readonly name: string;
  readonly currency: string;
  readonly createdAt: Date;
}

/**
 * Translates between the domain `Account` entity and the Typegoose
 * `AccountModel` persistence shape. Mongoose/Typegoose/BSON types are
 * confined to this file (and `account.model.ts`) — nothing leaks past
 * `MongoAccountRepository`'s public surface, which only returns `Account`
 * domain entities.
 *
 * `Account`'s constructor is private — rehydration goes through its public
 * `Account.create(...)` factory, passing the persisted `createdAt` as the
 * factory's `now` parameter so rehydration reproduces the exact original
 * timestamp rather than stamping a new one.
 */
export const AccountMapper = {
  /** Converts a hydrated Mongoose document into a domain `Account` entity. */
  toDomain(doc: DocumentType<AccountModel>): Account {
    return Account.create(
      doc._id.toString(),
      doc.workspaceId,
      doc.name,
      doc.currency,
      doc.createdAt,
    );
  },

  /** Converts a domain `Account` entity into the plain persistence shape. */
  toPersistence(account: Account): AccountPersistence {
    return {
      workspaceId: account.workspaceId,
      name: account.name,
      currency: account.currency,
      createdAt: account.createdAt,
    };
  },
};
