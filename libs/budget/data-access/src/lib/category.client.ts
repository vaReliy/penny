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
import { CurrentWorkspace } from 'shared-web-shell-data';

import type { CategoryView } from './budget-view-models';
import { fromIsoDate } from './date-boundary.util';

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
  private readonly currentWorkspace = inject(CurrentWorkspace);

  private categoriesBase(): string {
    const workspaceId = this.currentWorkspace.currentId();
    if (workspaceId === null) {
      throw new Error('CategoryClient called with no current workspace');
    }
    return `/api/workspaces/${workspaceId}/budget/categories`;
  }

  public list(): Observable<readonly CategoryView[]> {
    return this.http
      .get<CategoryListResponse>(this.categoriesBase(), {
        withCredentials: true,
      })
      .pipe(map((categories) => categories.map(toCategoryView)));
  }

  public create(request: CreateCategoryRequest): Observable<CategoryView> {
    return this.http
      .post<CategoryResponse>(this.categoriesBase(), request, {
        withCredentials: true,
      })
      .pipe(map(toCategoryView));
  }

  public update(
    id: string,
    request: UpdateCategoryRequest,
  ): Observable<CategoryView> {
    return this.http
      .patch<CategoryResponse>(`${this.categoriesBase()}/${id}`, request, {
        withCredentials: true,
      })
      .pipe(map(toCategoryView));
  }

  public archive(id: string): Observable<CategoryView> {
    return this.http
      .post<CategoryResponse>(`${this.categoriesBase()}/${id}/archive`, null, {
        withCredentials: true,
      })
      .pipe(map(toCategoryView));
  }
}
