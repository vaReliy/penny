import { HttpClient } from "@angular/common/http";
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

  addCategory(category: Category): Observable<Category> {
    return this.POST('categories', category).pipe(
      delay(500),
      map(v => v),
    );
  }
}
