import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from 'budget-contracts';

import type { CategoryView } from './budget-view-models';
import { fromIsoDate } from './date-boundary.util';

const CATEGORIES_BASE = '/api/budget/categories';

function toCategoryView(response: CategoryResponse): CategoryView {
  return {
    id: response.id,
    name: response.name,
    ...(response.archivedAt !== undefined
      ? { archivedAt: fromIsoDate(response.archivedAt) }
      : {}),
  };
}

/** Typed HTTP client for the budget vertical's `Category` operations. */
@Injectable({ providedIn: 'root' })
export class CategoryClient {
  private readonly http = inject(HttpClient);

  public list(): Observable<readonly CategoryView[]> {
    return this.http
      .get<CategoryListResponse>(CATEGORIES_BASE, { withCredentials: true })
      .pipe(map((categories) => categories.map(toCategoryView)));
  }

  public create(request: CreateCategoryRequest): Observable<CategoryView> {
    return this.http
      .post<CategoryResponse>(CATEGORIES_BASE, request, {
        withCredentials: true,
      })
      .pipe(map(toCategoryView));
  }

  public update(
    id: string,
    request: UpdateCategoryRequest,
  ): Observable<CategoryView> {
    return this.http
      .patch<CategoryResponse>(`${CATEGORIES_BASE}/${id}`, request, {
        withCredentials: true,
      })
      .pipe(map(toCategoryView));
  }

  public archive(id: string): Observable<CategoryView> {
    return this.http
      .post<CategoryResponse>(`${CATEGORIES_BASE}/${id}/archive`, null, {
        withCredentials: true,
      })
      .pipe(map(toCategoryView));
  }
}
