import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { Bill } from '../../common/models/bill.model';
import { CurrencyRatesModel } from '../../common/models/currency-rates.model';

@Component({
  selector: 'app-bill-card',
  templateUrl: './bill-card.component.html',
  styleUrls: ['./bill-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BillCardComponent {
  @Input() bill: Bill;
  @Input() rates: CurrencyRatesModel;
}
