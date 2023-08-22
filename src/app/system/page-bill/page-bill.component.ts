import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, combineLatest } from 'rxjs';

import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { Bill } from '../common/models/bill.model';
import { CurrencyRatesModel } from '../common/models/currency-rates.model';
import { BillService } from '../common/services/bill.service';

@Component({
  selector: 'app-page-bill',
  templateUrl: './page-bill.component.html',
  styleUrls: ['./page-bill.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageBillComponent extends UnsubscriberComponent implements OnInit {
  bill: Bill;
  rates: CurrencyRatesModel = new CurrencyRatesModel(Date.now(), 0, 0, 0);
  isLoaded$ = new BehaviorSubject<boolean>(false);

  constructor(private billService: BillService, private title: Title) {
    super();
    title.setTitle('Рахунок');
  }

  ngOnInit() {
    this.subs = combineLatest([
      this.billService.getBill(),
      this.billService.getExchangeRates(),
    ]).subscribe(([bill, rates]) => {
      this.bill = bill;
      this.rates = rates;
      this.isLoaded$.next(true);
    });
  }

  onRefresh() {
    this.isLoaded$.next(false);
    this.subs = this.billService.getExchangeRates().subscribe(rates => {
      this.rates = rates;
      this.isLoaded$.next(true);
    });
  }
}
