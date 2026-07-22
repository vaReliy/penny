import type { DocumentType } from '@typegoose/typegoose';

import { Transaction } from 'budget-core';
import { Money } from 'shared-util';
import type { TransactionType } from 'budget-contracts';

import type { TransactionModel } from './transaction.model.js';

/**
 * Plain persistence shape accepted by {@link MongoTransactionRepository} when
 * creating a document. Mirrors {@link TransactionModel}'s own fields (minus
 * Mongoose/Typegoose machinery) so callers outside this file never need to
 * reference Mongoose types.
 */
export interface TransactionPersistence {
  readonly workspaceId: string;
  readonly accountId: string;
  readonly categoryId: string;
  readonly type: TransactionType;
  readonly amount: bigint;
  readonly currency: string;
  readonly date: Date;
  readonly description?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

/**
 * Translates between the domain `Transaction` entity and the Typegoose
 * `TransactionModel` persistence shape. Mongoose/Typegoose/BSON types are
 * confined to this file (and `transaction.model.ts`) — nothing leaks past
 * `MongoTransactionRepository`'s public surface, which only returns
 * `Transaction` domain entities.
 *
 * `amount`/`currency` are stored as separate fields (per ADR-007: Mongoose
 * BigInt SchemaType for `amount`, plain string for `currency`) and
 * recombined into a single domain `Money` value here — the sole conversion
 * point, so minor units survive the round trip exactly (no float).
 *
 * `Transaction`'s constructor is private — rehydration goes through its
 * public `Transaction.create(...)` factory, passing the persisted
 * `createdAt` as the factory's `now` parameter so rehydration reproduces
 * the exact original timestamp rather than stamping a new one.
 */
export const TransactionMapper = {
  /** Converts a hydrated Mongoose document into a domain `Transaction` entity. */
  toDomain(doc: DocumentType<TransactionModel>): Transaction {
    return Transaction.create(
      doc._id.toString(),
      doc.workspaceId,
      doc.accountId,
      doc.categoryId,
      doc.type,
      Money.fromMinorUnits(doc.amount, doc.currency),
      doc.date,
      doc.createdBy,
      doc.description,
      doc.createdAt,
    );
  },

  /** Converts a domain `Transaction` entity into the plain persistence shape. */
  toPersistence(transaction: Transaction): TransactionPersistence {
    return {
      workspaceId: transaction.workspaceId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount.amount,
      currency: transaction.amount.currency,
      date: transaction.date,
      description: transaction.description,
      createdBy: transaction.createdBy,
      createdAt: transaction.createdAt,
    };
  },
};
