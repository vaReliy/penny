import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';

import { BillService } from '../shared/services/bill.service';

@Component({
  selector: 'app-page-bill',
  templateUrl: './page-bill.component.html',
  styleUrls: ['./page-bill.component.scss'],
})
export class PageBillComponent implements OnInit, OnDestroy {
  private subscription: Subscription;

  constructor(
    private billService: BillService,
  ) { }

  ngOnInit() {
    this.subscription = combineLatest(
      this.billService.getBill(),
      this.billService.getExchangeRates(),
    )
      .subscribe(([bill, rates]) => {
        console.log(bill, rates);
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }



}
