import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { BaseApi } from '../../../shared/core/base-api';
import { Bill } from '../models/bill.model';
import {
  CurrencyRatesModel,
  getEmpptyCurrencyRatesModelDto,
} from '../models/currency-rates.model';
import {
  CurrencyInfoMonobank,
  getCurrencyCodeByName,
  getCurrencyNameByCode,
} from '../models/CurrencyInfoMonobank';
import { flatDtoToInstance } from './dto-transformer';

@Injectable()
export class BillService extends BaseApi {
  constructor(protected http: HttpClient) {
    super(http);
  }

  getBill(): Observable<Bill> {
    return this.GET('bill').pipe(map(v => flatDtoToInstance<Bill>(v, Bill)));
  }

  updateBill(bill: Bill): Observable<Bill> {
    return this.POST('bill', bill).pipe(
      map(v => flatDtoToInstance<Bill>(v, Bill))
    );
  }

  getExchangeRates(): Observable<CurrencyRatesModel> {
    return this.http.get('https://api.monobank.ua/bank/currency').pipe(
      map((data: CurrencyInfoMonobank[]) => {
        const result = [];
        let date = Date.now();
        data.forEach((currency: CurrencyInfoMonobank) => {
          const name = getCurrencyNameByCode(currency.currencyCodeA);
          if (name && currency.currencyCodeB === getCurrencyCodeByName('UAH')) {
            date = currency.date * 1000;
            result.push({ name, rate: currency.rateSell });
          }
        });

        result.push({ name: 'UAH', rate: 1 });
        const rates = result.reduce((acc, el) => {
          acc[el.name] = el.rate;
          return acc;
        }, {});
        const { UAH, USD, EUR } = rates;

        return flatDtoToInstance<CurrencyRatesModel>(
          {
            UAH,
            USD,
            EUR,
            updatedAt: date,
          },
          CurrencyRatesModel
        );
      }),
      catchError(e => {
        console.error(e);
        return of(
          flatDtoToInstance<CurrencyRatesModel>(
            getEmpptyCurrencyRatesModelDto(),
            CurrencyRatesModel
          )
        );
      })
    );
  }
}
