import { Component, Input, OnInit } from '@angular/core';

import { CurrencyRatesModel } from '../../shared/models/currency-rates.model';

@Component({
  selector: 'app-currency-card',
  templateUrl: './currency-card.component.html',
  styleUrls: ['./currency-card.component.scss']
})
export class CurrencyCardComponent implements OnInit {
  @Input() rates: CurrencyRatesModel;
  @Input() date: Date = new Date();

  constructor() { }

  ngOnInit() {
  }

}
