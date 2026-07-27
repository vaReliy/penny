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

/** Signal-based state for the budget vertical's `Category` list. */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly client = inject(CategoryClient);
  private readonly requestState = new BudgetRequestState(
    inject(BudgetSessionExpiryService),
  );
  private readonly categoriesSignal = signal<readonly CategoryView[]>([]);

  public get data(): Signal<readonly CategoryView[]> {
    return this.categoriesSignal;
  }

  public get loading(): Signal<boolean> {
    return this.requestState.loading;
  }

  public get error(): Signal<BudgetApiError | null> {
    return this.requestState.error;
  }

  public load(): void {
    this.requestState.run(this.client.list(), (categories) => {
      this.categoriesSignal.set(categories);
    });
  }

  public create(request: CreateCategoryRequest): void {
    this.requestState.run(this.client.create(request), (created) => {
      this.categoriesSignal.set([...this.categoriesSignal(), created]);
    });
  }

  public update(id: string, request: UpdateCategoryRequest): void {
    this.requestState.run(this.client.update(id, request), (updated) => {
      this.categoriesSignal.set(
        this.categoriesSignal().map((category) =>
          category.id === updated.id ? updated : category,
        ),
      );
    });
  }

  public archive(id: string): void {
    this.requestState.run(this.client.archive(id), (archived) => {
      this.categoriesSignal.set(
        this.categoriesSignal().map((category) =>
          category.id === archived.id ? archived : category,
        ),
      );
    });
  }
}
