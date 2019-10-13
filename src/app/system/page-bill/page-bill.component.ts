import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';

import { BillModel } from '../shared/models/bill.model';
import { CurrencyRatesModel } from '../shared/models/currency-rates.model';
import { BillService } from '../shared/services/bill.service';

@Component({
  selector: 'app-page-bill',
  templateUrl: './page-bill.component.html',
  styleUrls: ['./page-bill.component.scss'],
})
export class PageBillComponent implements OnInit, OnDestroy {
  private subscription: Subscription;
  private subscription2: Subscription;
  bill: BillModel;
  rates: CurrencyRatesModel = new CurrencyRatesModel(0, 0, 0);
  date: Date = new Date();
  isLoaded = false;

  constructor(
    private billService: BillService,
  ) {
  }

  ngOnInit() {
    this.subscription = combineLatest(
      this.billService.getBill(),
      this.billService.getExchangeRates(),
    )
      .subscribe(([bill, rates]) => {
        this.bill = bill;
        this.rates = rates;
        this.isLoaded = true;
      });
  }

  onRefresh() {
    this.isLoaded = false;
    this.subscription2 = this.billService.getExchangeRates()
      .subscribe(rates => {
        this.rates = rates;
        this.isLoaded = true;
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.subscription2) {
      this.subscription2.unsubscribe();
    }
  }

}
