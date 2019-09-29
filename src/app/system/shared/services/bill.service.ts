import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { BillModel } from '../models/bill.model';
import { CurrencyRatesModel } from '../models/currency-rates.model';

@Injectable()
export class BillService extends BaseApi {

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  getBill(): Observable<BillModel> {
    return this.GET('bill')
      .pipe(
        map(v => new BillModel(v.value, v.currency)),
      );
  }

  getExchangeRates(): Observable<CurrencyRatesModel> {
    return this.GET('rates')
      .pipe(
        map((v: any) => new CurrencyRatesModel(v.UAH, v.USD / 1000000, v.EUR / 1000000)),
      );
  }
}
