import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Money } from 'shared-util';
import type { TransactionView } from 'budget-data-access';
import { TransactionListComponent } from './transaction-list';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  history: {
    list: {
      title: 'Список операцій',
      searchLabel: 'Пошук',
      sortLabel: 'Сортувати за',
      emptyNoneAtAll: 'Ще немає жодної операції.',
      emptyForFilter: 'Фільтр не знайшов жодної операції.',
      emptySearch: 'Нічого не знайдено.',
      columnDate: 'Дата',
      columnAmount: 'Сума',
      columnCategory: 'Категорія',
      columnType: 'Тип',
    },
    filter: {
      typeIncome: 'Дохід',
      typeExpense: 'Витрата',
    },
  },
};

function makeTransaction(
  overrides: Partial<TransactionView> & { id: string },
): TransactionView {
  return {
    accountId: 'a1',
    categoryId: 'c1',
    type: 'expense',
    amount: Money.fromMinorUnits(10000n, 'UAH'),
    date: new Date('2026-07-01T00:00:00.000Z'),
    createdBy: 'u1',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TransactionListComponent', () => {
  let fixture: ComponentFixture<TransactionListComponent>;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        TransactionListComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionListComponent);
  }

  async function detectAndStabilize(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setMobileViewport(): void {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    window.dispatchEvent(new Event('resize'));
  }

  const MOBILE_SORT_AMOUNT_INDEX = 1;

  function mobileSortButtons(): HTMLButtonElement[] {
    return fixture.debugElement
      .queryAll(By.css('[role="group"] button'))
      .map((el) => el.nativeElement as HTMLButtonElement);
  }

  it('renders one row per transaction, in both the card list and the table', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({ id: 't1' }),
      makeTransaction({ id: 't2', categoryId: 'c2', type: 'income' }),
    ]);
    fixture.componentRef.setInput('categories', [
      { id: 'c1', name: 'Їжа' },
      { id: 'c2', name: 'Зарплата' },
    ]);
    await detectAndStabilize();

    expect(fixture.debugElement.queryAll(By.css('ul > li')).length).toBe(2);
    expect(fixture.debugElement.queryAll(By.css('tbody > tr')).length).toBe(2);
  });

  it('filters rows via the search box', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({ id: 't1', categoryId: 'c1' }),
      makeTransaction({ id: 't2', categoryId: 'c2' }),
    ]);
    fixture.componentRef.setInput('categories', [
      { id: 'c1', name: 'Їжа' },
      { id: 'c2', name: 'Транспорт' },
    ]);
    await detectAndStabilize();

    const input = fixture.debugElement.query(By.css('input[type="search"]'))
      .nativeElement as HTMLInputElement;
    input.value = 'Транспорт';
    input.dispatchEvent(new Event('input'));
    await detectAndStabilize();

    expect(fixture.debugElement.queryAll(By.css('tbody > tr')).length).toBe(1);
  });

  it('toggles sort direction when a column header is clicked twice', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({
        id: 't1',
        amount: Money.fromMinorUnits(1000n, 'UAH'),
      }),
      makeTransaction({
        id: 't2',
        amount: Money.fromMinorUnits(5000n, 'UAH'),
      }),
    ]);
    await detectAndStabilize();

    const amountHeaderButton = fixture.debugElement.queryAll(
      By.css('thead button'),
    )[1]?.nativeElement as HTMLButtonElement;
    amountHeaderButton.click();
    await detectAndStabilize();

    const firstRowAfterAsc = fixture.debugElement.query(
      By.css('tbody > tr:first-child'),
    ).nativeElement as HTMLElement;
    expect(firstRowAfterAsc.textContent).toContain('10,00');

    amountHeaderButton.click();
    await detectAndStabilize();

    const firstRowAfterDesc = fixture.debugElement.query(
      By.css('tbody > tr:first-child'),
    ).nativeElement as HTMLElement;
    expect(firstRowAfterDesc.textContent).toContain('50,00');
  });

  it('renders a mobile sort control at a 390px viewport', async () => {
    await setup();
    setMobileViewport();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({ id: 't1' }),
      makeTransaction({ id: 't2' }),
    ]);
    await detectAndStabilize();

    expect(mobileSortButtons().length).toBe(4);
  });

  it('reorders the mobile card list when sort is changed at 390px', async () => {
    await setup();
    setMobileViewport();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({
        id: 't1',
        amount: Money.fromMinorUnits(1000n, 'UAH'),
      }),
      makeTransaction({
        id: 't2',
        amount: Money.fromMinorUnits(5000n, 'UAH'),
      }),
    ]);
    await detectAndStabilize();

    mobileSortButtons()[MOBILE_SORT_AMOUNT_INDEX].click();
    await detectAndStabilize();

    const firstCardAfterAsc = fixture.debugElement.query(
      By.css('ul > li:first-child'),
    ).nativeElement as HTMLElement;
    expect(firstCardAfterAsc.textContent).toContain('10,00');
  });

  it('shares sort state between the mobile control and the desktop headers', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({
        id: 't1',
        amount: Money.fromMinorUnits(1000n, 'UAH'),
      }),
      makeTransaction({
        id: 't2',
        amount: Money.fromMinorUnits(5000n, 'UAH'),
      }),
    ]);
    await detectAndStabilize();

    mobileSortButtons()[MOBILE_SORT_AMOUNT_INDEX].click();
    await detectAndStabilize();

    const desktopAmountHeader = fixture.debugElement.queryAll(
      By.css('thead th'),
    )[1]?.nativeElement as HTMLElement;
    expect(desktopAmountHeader.getAttribute('aria-sort')).toBe('ascending');

    const desktopAmountButton = fixture.debugElement.queryAll(
      By.css('thead button'),
    )[1]?.nativeElement as HTMLButtonElement;
    desktopAmountButton.click();
    await detectAndStabilize();

    expect(desktopAmountHeader.getAttribute('aria-sort')).toBe('descending');
    expect(
      mobileSortButtons()[MOBILE_SORT_AMOUNT_INDEX].getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
  });

  it('binds aria-sort to the active column only, with ascending/descending/none', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({ id: 't1' }),
    ]);
    await detectAndStabilize();

    const headers = fixture.debugElement
      .queryAll(By.css('thead th'))
      .map((el) => el.nativeElement as HTMLElement);

    expect(headers[0].getAttribute('aria-sort')).toBe('descending');
    expect(headers[1].getAttribute('aria-sort')).toBe('none');
    expect(headers[2].getAttribute('aria-sort')).toBe('none');
    expect(headers[3].getAttribute('aria-sort')).toBe('none');
  });

  it('renders a visible direction indicator on the active sort column', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({ id: 't1' }),
    ]);
    await detectAndStabilize();

    const activeHeaderIndicator = fixture.debugElement.query(
      By.css('thead th:first-child span[aria-hidden="true"]'),
    );
    expect(activeHeaderIndicator).toBeTruthy();
    expect(
      (activeHeaderIndicator.nativeElement as HTMLElement).textContent,
    ).toBe('▼');
  });

  it('shows the "no transactions at all" empty state', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', []);
    fixture.componentRef.setInput('emptyReason', 'noneAtAll');
    await detectAndStabilize();

    expect(fixture.nativeElement.textContent).toContain(
      'Ще немає жодної операції.',
    );
  });

  it('shows the "filter matched nothing" empty state', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', []);
    fixture.componentRef.setInput('emptyReason', 'noneForFilter');
    await detectAndStabilize();

    expect(fixture.nativeElement.textContent).toContain(
      'Фільтр не знайшов жодної операції.',
    );
  });

  it('applies detailQueryParams to each row link', async () => {
    await setup();
    fixture.componentRef.setInput('transactions', [
      makeTransaction({ id: 't1' }),
    ]);
    fixture.componentRef.setInput('detailQueryParams', { period: 'day' });
    await detectAndStabilize();

    const link = fixture.debugElement.query(By.css('ul a'))
      .nativeElement as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('period=day');
  });
});
