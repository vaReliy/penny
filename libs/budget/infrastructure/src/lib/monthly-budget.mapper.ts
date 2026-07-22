import type { DocumentType } from '@typegoose/typegoose';

import { MonthlyBudget } from 'budget-core';
import { Money } from 'shared-util';

import type { MonthlyBudgetModel } from './monthly-budget.model.js';

/**
 * Plain persistence shape accepted by {@link MongoMonthlyBudgetRepository}
 * when creating/upserting a document. Mirrors {@link MonthlyBudgetModel}'s
 * own fields (minus Mongoose/Typegoose machinery) so callers outside this
 * file never need to reference Mongoose types.
 */
export interface MonthlyBudgetPersistence {
  readonly workspaceId: string;
  readonly categoryId: string;
  readonly month: string;
  readonly amount: bigint;
  readonly currency: string;
}

/**
 * Translates between the domain `MonthlyBudget` entity and the Typegoose
 * `MonthlyBudgetModel` persistence shape. Mongoose/Typegoose/BSON types are
 * confined to this file (and `monthly-budget.model.ts`) — nothing leaks
 * past `MongoMonthlyBudgetRepository`'s public surface, which only returns
 * `MonthlyBudget` domain entities.
 *
 * `amount`/`currency` are stored as separate fields (per ADR-007: Mongoose
 * BigInt SchemaType for `amount`, plain string for `currency`) and
 * recombined into a single domain `Money` value here — the sole conversion
 * point, so minor units survive the round trip exactly (no float).
 */
export const MonthlyBudgetMapper = {
  /** Converts a hydrated Mongoose document into a domain `MonthlyBudget` entity. */
  toDomain(doc: DocumentType<MonthlyBudgetModel>): MonthlyBudget {
    return MonthlyBudget.create(
      doc._id.toString(),
      doc.workspaceId,
      doc.categoryId,
      doc.month,
      Money.fromMinorUnits(doc.amount, doc.currency),
    );
  },

  /** Converts a domain `MonthlyBudget` entity into the plain persistence shape. */
  toPersistence(budget: MonthlyBudget): MonthlyBudgetPersistence {
    return {
      workspaceId: budget.workspaceId,
      categoryId: budget.categoryId,
      month: budget.month,
      amount: budget.amount.amount,
      currency: budget.amount.currency,
    };
  },
};
