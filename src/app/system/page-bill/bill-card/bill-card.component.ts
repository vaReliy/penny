import { Component, Input, OnInit } from '@angular/core';

import { BillModel } from '../../shared/models/bill.model';
import { CurrencyRatesModel } from '../../shared/models/currency-rates.model';

@Component({
  selector: 'app-bill-card',
  templateUrl: './bill-card.component.html',
  styleUrls: ['./bill-card.component.scss']
})
export class BillCardComponent implements OnInit {
  @Input() bill: BillModel;
  @Input() rates: CurrencyRatesModel;
  @Input() date: Date = new Date();

  constructor() { }

  ngOnInit() {
  }

}