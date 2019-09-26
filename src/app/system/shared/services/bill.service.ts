import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { BaseApi } from '../../../shared/core/base-api';

@Injectable()
export class BillService extends BaseApi {

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  getBill(): any {
    return this.GET('bill');
  }

  getExchangeRates(): any {
    return this.GET('rates');
  }
}
