import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AccountPageComponent } from './account-page';

const UK_TRANSLATIONS = { common: { loading: 'Завантаження...' } };
const BUDGET_UK_TRANSLATIONS = {
  account: {
    page: {
      error: 'Не вдалося завантажити дані рахунку. Спробуйте ще раз.',
      retry: 'Спробувати ще раз',
    },
    balanceCard: { title: 'Рахунок', zeroHint: 'Немає операцій' },
    ratesCard: {
      title: 'Курс',
      refresh: 'Оновити курс',
      refreshing: 'Оновлення...',
      currency: 'Валюта',
      rate: 'Курс',
      fetchedAt: 'Оновлено:',
      refreshError: 'Не вдалося оновити курс. Показано останні відомі дані.',
    },
  },
};

describe('AccountPageComponent', () => {
  let fixture: ComponentFixture<AccountPageComponent>;
  let httpController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AccountPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('shows the loading state before balance/rates arrive', async () => {
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Завантаження...');

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '415000', currency: 'UAH' },
    });
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });
  });

  it('renders balance and rates cards once both requests resolve', async () => {
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '415000', currency: 'UAH' },
    });
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('UAH');
    expect(el.textContent).toContain('USD');
  });

  it('refreshing rates re-fetches only /api/rates, not /api/budget/balance', async () => {
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '415000', currency: 'UAH' },
    });
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'lib-rates-card button',
    ) as HTMLButtonElement;
    button.click();

    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '42.0000' }],
      asOf: '2026-07-27T11:00:00.000Z',
    });
    httpController.expectNone('/api/budget/balance');
  });

  it('shows the error state and retries on button click', async () => {
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();

    httpController
      .expectOne('/api/budget/balance')
      .flush(
        { code: 'UNKNOWN_ERROR', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    httpController
      .expectOne('/api/rates')
      .flush(
        { code: 'UNKNOWN_ERROR', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Не вдалося завантажити дані рахунку');

    const retryButton = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    retryButton.click();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '0', currency: 'UAH' },
    });
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [],
      asOf: '2026-07-27T12:00:00.000Z',
    });
  });

  it('a failed refresh surfaces an inline error but keeps the stale rates rendered', async () => {
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '415000', currency: 'UAH' },
    });
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'lib-rates-card button',
    ) as HTMLButtonElement;
    button.click();

    httpController
      .expectOne('/api/rates')
      .flush(
        { code: 'UNKNOWN_ERROR', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const alert = fixture.nativeElement.querySelector(
      '[role="alert"]',
    ) as HTMLElement | null;
    expect(alert?.textContent).toContain('Не вдалося оновити курс');

    // Stale data from the successful initial load must still be visible —
    // a failed refresh must never blank the screen or drop known-good data.
    expect(el.textContent).toContain('41.5000');
    expect(el.textContent).toContain('UAH');
  });
});
