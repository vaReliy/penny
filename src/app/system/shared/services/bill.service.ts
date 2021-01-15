import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { Bill } from '../models/bill.model';
import { CurrencyRatesModel } from '../models/currency-rates.model';
import { CurrencyInfoMonobank, getCurrencyCodeByName, getCurrencyNameByCode } from '../models/CurrencyInfoMonobank';

@Injectable()
export class BillService extends BaseApi {
  private rates: CurrencyRatesModel = null;
  private ratesDateStamp: number;

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  getBill(): Observable<Bill> {
    return this.GET('bill')
      .pipe(
        map(v => new Bill(v.value, v.currency)),
      );
  }

  updateBill(bill: Bill): Observable<Bill> {
    return this.POST('bill', bill)
      .pipe(
        map(v => new Bill(v.value, v.currency)),
      );
  }

  /*getExchangeRates(): Observable<CurrencyRatesModel> {
    return this.GET('rates')
      .pipe(
        map((v: any) => new CurrencyRatesModel(v.UAH, v.USD / 1000000, v.EUR / 1000000)),
      );
  }*/

  getRates(): Observable<CurrencyRatesModel> {
    const nonUpdateTimeMs = 1000 * 60 * 60 * 3; // 3 hours
    if (this.ratesDateStamp > Date.now() - nonUpdateTimeMs) {
      return of(this.rates);
    }

    return this.getExchangeRates();
  }

  getExchangeRates(): Observable<CurrencyRatesModel> { // todo: move to backend?
    return this.http.get('https://api.monobank.ua/bank/currency')
      .pipe(
        map((data: CurrencyInfoMonobank[]) => {
          const result = [];
          let date = Date.now();
          this.ratesDateStamp = date;
          data.forEach((currency: CurrencyInfoMonobank) => {
            const name = getCurrencyNameByCode(currency.currencyCodeA);
            if (name && currency.currencyCodeB === getCurrencyCodeByName('UAH')) {
              date = currency.date * 1000;
              result.push({name, rate: currency.rateSell});
            }
          });

          result.push({name: 'UAH', rate: 1});
          const rates = result.reduce((acc, el) => {
            acc[el.name] = el.rate;
            return acc;
          }, {});

          return new CurrencyRatesModel(date, rates.UAH, rates.USD, rates.EUR);
        }),
        catchError(e => {
          console.error(e);
          return of(new CurrencyRatesModel(0, 0, 0, 0));
        }),
        tap((rates: CurrencyRatesModel) => {
          this.rates = rates;
        })
      );
  }
}
