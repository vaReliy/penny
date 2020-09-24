export interface CurrencyInfoMonobank {
  currencyCodeA: number;
  currencyCodeB: number;
  date: number;
  rateSell: number;
  rateBuy: number;
}

export function getCurrencyCodeByName(name: string): number {
  switch (name) {
    case 'EUR': return 878;
    case 'UAH': return 980;
    case 'USD': return 840;
  }
}

export function getCurrencyNameByCode(code: number): string {
  switch (code) {
    case 978: return 'EUR';
    case 980: return 'UAH';
    case 840: return 'USD';
    default: return '';
  }
}

