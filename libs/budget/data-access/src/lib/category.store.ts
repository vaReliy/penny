import { Injectable, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type {
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from 'budget-contracts';

import { CategoryClient } from './category.client';
import { BudgetRequestState } from './budget-request-state';
import { BudgetSessionExpiryService } from './budget-session-expiry.service';
import type { BudgetApiError } from './budget-api-error';
import type { CategoryView } from './budget-view-models';

/**
 * Signal-based state for the budget vertical's `Category` list.
 *
 * One `BudgetRequestState` per operation (list / create / update / archive)
 * rather than a single shared instance, so a settling operation's
 * `loading`/`error` clear can't clobber a sibling operation still in flight.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly client = inject(CategoryClient);
  private readonly sessionExpiry = inject(BudgetSessionExpiryService);
  private readonly listRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly createRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly updateRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly archiveRequestState = new BudgetRequestState(
    this.sessionExpiry,
  );
  private readonly categoriesSignal = signal<readonly CategoryView[]>([]);

  public get data(): Signal<readonly CategoryView[]> {
    return this.categoriesSignal;
  }

  public get listLoading(): Signal<boolean> {
    return this.listRequestState.loading;
  }

  public get listError(): Signal<BudgetApiError | null> {
    return this.listRequestState.error;
  }

  public get createLoading(): Signal<boolean> {
    return this.createRequestState.loading;
  }

  public get createError(): Signal<BudgetApiError | null> {
    return this.createRequestState.error;
  }

  public get updateLoading(): Signal<boolean> {
    return this.updateRequestState.loading;
  }

  public get updateError(): Signal<BudgetApiError | null> {
    return this.updateRequestState.error;
  }

  public get archiveLoading(): Signal<boolean> {
    return this.archiveRequestState.loading;
  }

  public get archiveError(): Signal<BudgetApiError | null> {
    return this.archiveRequestState.error;
  }

  public load(): void {
    this.listRequestState.run(this.client.list(), (categories) => {
      this.categoriesSignal.set(categories);
    });
  }

  public create(request: CreateCategoryRequest): void {
    this.createRequestState.run(this.client.create(request), (created) => {
      this.categoriesSignal.set([...this.categoriesSignal(), created]);
    });
  }

  public update(id: string, request: UpdateCategoryRequest): void {
    this.updateRequestState.run(this.client.update(id, request), (updated) => {
      this.categoriesSignal.set(
        this.categoriesSignal().map((category) =>
          category.id === updated.id ? updated : category,
        ),
      );
    });
  }

  public archive(id: string): void {
    this.archiveRequestState.run(this.client.archive(id), (archived) => {
      this.categoriesSignal.set(
        this.categoriesSignal().map((category) =>
          category.id === archived.id ? archived : category,
        ),
      );
    });
  }
}
