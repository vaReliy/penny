import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, combineLatest } from 'rxjs';

import { UnsubscriberComponent } from 'src/app/shared/core/unsubscriber';
import { Bill } from '../common/models/bill.model';
import {
  CurrencyRatesModel,
  getEmpptyCurrencyRatesModelDto,
} from '../common/models/currency-rates.model';
import { BillService } from '../common/services/bill.service';
import { flatDtoToInstance } from '../common/services/dto-transformer';

@Component({
    selector: 'app-page-bill',
    templateUrl: './page-bill.component.html',
    styleUrls: ['./page-bill.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class PageBillComponent extends UnsubscriberComponent implements OnInit {
  bill: Bill;
  rates: CurrencyRatesModel = flatDtoToInstance<CurrencyRatesModel>(
    getEmpptyCurrencyRatesModelDto(),
    CurrencyRatesModel
  );
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
