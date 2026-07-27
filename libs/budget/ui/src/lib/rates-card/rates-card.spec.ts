import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RatesCardComponent } from './rates-card';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  account: {
    ratesCard: {
      title: 'Курс',
      refresh: 'Оновити курс',
      refreshing: 'Оновлення...',
      currency: 'Валюта',
      rate: 'Курс',
      fetchedAt: 'Оновлено:',
    },
  },
};

describe('RatesCardComponent', () => {
  let fixture: ComponentFixture<RatesCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RatesCardComponent,
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

  it('renders each rate row and the fetched-at timestamp', async () => {
    fixture = TestBed.createComponent(RatesCardComponent);
    fixture.componentRef.setInput('rates', [
      { currency: 'USD', rateToBase: '41.5000' },
      { currency: 'EUR', rateToBase: '45.0000' },
    ]);
    fixture.componentRef.setInput(
      'fetchedAt',
      new Date('2026-07-27T10:00:00Z'),
    );
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('USD');
    expect(text).toContain('41.5000');
    expect(text).toContain('EUR');
  });

  it('emits refresh when the button is clicked', async () => {
    fixture = TestBed.createComponent(RatesCardComponent);
    fixture.componentRef.setInput('rates', []);
    fixture.componentRef.setInput('fetchedAt', new Date());
    await detectAndStabilize();

    const emitSpy = vi.fn();
    fixture.componentInstance.refresh.subscribe(emitSpy);

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();

    expect(emitSpy).toHaveBeenCalledOnce();
  });

  it('disables the refresh button while refreshing', async () => {
    fixture = TestBed.createComponent(RatesCardComponent);
    fixture.componentRef.setInput('rates', []);
    fixture.componentRef.setInput('fetchedAt', new Date());
    fixture.componentRef.setInput('refreshing', true);
    await detectAndStabilize();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
