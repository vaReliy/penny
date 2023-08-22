import { CurrencyEnum } from './currency.enum';

export class Bill {
  constructor(public value: number, public currency: CurrencyEnum) {}
}
