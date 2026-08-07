import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HistoryPageComponent } from './history-page';

const UK_TRANSLATIONS = {};
const UNKNOWN_ERROR_TEXT = 'Щось пішло не так. Спробуйте ще раз.';
const BUDGET_UK_TRANSLATIONS = {
  errors: {
    unknown: UNKNOWN_ERROR_TEXT,
  },
  history: {
    page: { title: 'Історія', openFilter: 'Фільтр', closeFilter: 'Готово' },
    chart: { title: 'Витрати за категоріями', empty: 'Немає даних.' },
    filter: {
      title: 'Фільтр',
      typeLabel: 'Тип',
      typeAll: 'Усі',
      typeIncome: 'Дохід',
      typeExpense: 'Витрата',
      categoryLabel: 'Категорія',
      categoryAll: 'Усі категорії',
      periodLabel: 'Період',
      periodAll: 'Весь час',
      periodDay: 'День',
      periodWeek: 'Тиждень',
      periodMonth: 'Місяць',
      monthLabel: 'Місяць',
      clear: 'Скинути',
    },
    list: {
      title: 'Список операцій',
      searchLabel: 'Пошук',
      emptyNoneAtAll: 'Ще немає жодної операції.',
      emptyForFilter: 'Фільтр не знайшов жодної операції.',
      emptySearch: 'Нічого не знайдено.',
      columnDate: 'Дата',
      columnAmount: 'Сума',
      columnCategory: 'Категорія',
      columnType: 'Тип',
    },
  },
};

describe('HistoryPageComponent', () => {
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let navigateMock: ReturnType<typeof vi.fn>;
  let httpController: HttpTestingController;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});
    navigateMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [
        HistoryPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
        { provide: Router, useValue: { navigate: navigateMock } },
      ],
    }).compileComponents();

    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('loads categories, transactions, and chart on init with the initial (empty) filter', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();

    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush([]);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('re-loads transactions/chart with the new params when query params change', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush([]);

    queryParamsSubject.next({
      type: 'income',
      period: 'month',
      month: '2026-03',
    });
    fixture.detectChanges();

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/transactions' &&
          candidate.params.get('type') === 'income' &&
          candidate.params.get('month') === '2026-03',
      )
      .flush([]);
    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/chart' &&
          candidate.params.get('month') === '2026-03',
      )
      .flush([]);
  });

  it('navigates with the mapped query params when the filter panel emits a change', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush([]);

    fixture.componentInstance['onFilterChange']({ type: 'expense' });

    expect(navigateMock).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ type: 'expense' }),
      }),
    );
  });

  it('reports "noneAtAll" when the filter is empty and the list is empty', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush([]);

    expect(fixture.componentInstance['emptyReason']()).toBe('noneAtAll');
  });

  it('reports "noneForFilter" when a filter is active and the list is empty', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush([]);

    queryParamsSubject.next({ type: 'income' });
    fixture.detectChanges();
    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/transactions' &&
          candidate.params.get('type') === 'income',
      )
      .flush([]);
    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/chart' &&
          candidate.params.keys().length === 0,
      )
      .flush([]);

    expect(fixture.componentInstance['emptyReason']()).toBe('noneForFilter');
  });

  it('surfaces a 500 from the transactions list as a role="alert" message, without touching the chart', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush([]);
    fixture.detectChanges();

    expect(
      fixture.componentInstance['transactionStore'].listError()?.kind,
    ).toBe('UNKNOWN');
    const alert = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="alert"]',
    );
    expect(alert?.textContent?.trim()).toBe(UNKNOWN_ERROR_TEXT);
    expect(alert?.textContent).not.toContain(
      'Something went wrong. Please try again.',
    );
    expect(fixture.componentInstance['dashboardStore'].chartError()).toBeNull();
  });

  it('surfaces a 500 from the chart endpoint as a role="alert" message, without touching the list', () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/transactions')
      .flush([]);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/chart')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance['dashboardStore'].chartError()?.kind).toBe(
      'UNKNOWN',
    );
    expect(
      fixture.componentInstance['transactionStore'].listError(),
    ).toBeNull();
  });
});
