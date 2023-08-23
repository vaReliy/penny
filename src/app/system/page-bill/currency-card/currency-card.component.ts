import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CurrencyRatesModel } from '../../common/models/currency-rates.model';

@Component({
  selector: 'app-currency-card',
  templateUrl: './currency-card.component.html',
  styleUrls: ['./currency-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyCardComponent {
  @Input() rates: CurrencyRatesModel;
  @Input() date: Date = new Date();

  @Output() rateUpdate = new EventEmitter();
}
