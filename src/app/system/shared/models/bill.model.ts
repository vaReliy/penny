import { CurrencyEnum } from './currency.enum';

export class BillModel {
  constructor(
    public value: number,
    public currency: CurrencyEnum,
  ) {}
}
