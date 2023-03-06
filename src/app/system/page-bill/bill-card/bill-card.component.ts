import { Component, Input } from '@angular/core'

import { Bill } from '../../shared/models/bill.model'
import { CurrencyRatesModel } from '../../shared/models/currency-rates.model'

@Component({
  selector: 'app-bill-card',
  templateUrl: './bill-card.component.html',
  styleUrls: ['./bill-card.component.scss']
})
export class BillCardComponent {
  @Input() bill: Bill;
  @Input() rates: CurrencyRatesModel;


}
