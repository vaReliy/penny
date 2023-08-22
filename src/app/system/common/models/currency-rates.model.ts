export class CurrencyRatesModel {
  public updatedAt: number;
  public UAH: number;
  public USD: number;
  public EUR: number;
}

export const getEmpptyCurrencyRatesModelDto = () => ({
  updatedAt: Date.now(),
  UAH: 0,
  USD: 0,
  EUR: 0,
});
