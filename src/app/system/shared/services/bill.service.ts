import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { Bill } from '../models/bill.model';
import { CurrencyRatesModel } from '../models/currency-rates.model';

@Injectable()
export class BillService extends BaseApi {

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  getBill(): Observable<Bill> {
    return this.GET('bill')
      .pipe(
        delay(500),
        map(v => new Bill(v.value, v.currency)),
      );
  }

  getExchangeRates(): Observable<CurrencyRatesModel> {
    return this.GET('rates')
      .pipe(
        delay(1500),
        map((v: any) => new CurrencyRatesModel(v.UAH, v.USD / 1000000, v.EUR / 1000000)),
      );
  }
}
