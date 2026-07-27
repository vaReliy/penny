import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Money } from 'shared-util';
import { BalanceCardComponent } from './balance-card';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  account: {
    balanceCard: {
      title: 'Рахунок',
      zeroHint: 'У вас ще немає операцій. Баланс дорівнює нулю.',
    },
  },
};

describe('BalanceCardComponent', () => {
  let fixture: ComponentFixture<BalanceCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BalanceCardComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
    }).compileComponents();
  });

  async function detectAndStabilize(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the base-currency balance and each converted currency', async () => {
    fixture = TestBed.createComponent(BalanceCardComponent);
    fixture.componentRef.setInput(
      'balance',
      Money.fromMinorUnits(415000n, 'UAH'),
    );
    fixture.componentRef.setInput('rates', [
      { currency: 'USD', rateToBase: '41.5000' },
      { currency: 'EUR', rateToBase: '45.0000' },
    ]);
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('UAH');
    expect(text).toContain('USD');
    expect(text).toContain('EUR');
  });

  it('shows the zero-balance hint when balance is zero', async () => {
    fixture = TestBed.createComponent(BalanceCardComponent);
    fixture.componentRef.setInput('balance', Money.zero('UAH'));
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('У вас ще немає операцій');
  });

  it('does not show the zero-balance hint for a non-zero balance', async () => {
    fixture = TestBed.createComponent(BalanceCardComponent);
    fixture.componentRef.setInput('balance', Money.fromMinorUnits(100n, 'UAH'));
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('У вас ще немає операцій');
  });
});
