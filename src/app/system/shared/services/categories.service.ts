import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { Category } from '../models/category.model';

@Injectable()
export class CategoriesService extends BaseApi {

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  getCategories(): Observable<Category[]> {
    return this.GET('categories').pipe(
      delay(500),
      map(categories => {
        const result = [];
        categories.forEach((c: Category) => {
          result.push(new Category(
            c.name,
            c.capacity,
            c.id,
          ));
        });
        return result;
      }),
    );
  }

  addCategory(category: Category): Observable<Category> {
    return this.POST('categories', category).pipe(
      delay(500),
      map(v => v),
    );
  }

  updateCategory(category: Category): Observable<Category> {
    return this.PUT(`categories/${category.id}`, category).pipe(
      delay(500),
      map(v => v),
    );
  }
}
