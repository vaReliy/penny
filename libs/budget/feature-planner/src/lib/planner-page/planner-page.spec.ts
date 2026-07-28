import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { PlannerPageComponent } from './planner-page';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  planner: {
    page: {
      title: 'Планувальник',
      previousMonth: 'Попередній місяць',
      nextMonth: 'Наступний місяць',
      emptyMonth: 'Бюджети на цей місяць ще не встановлено.',
      totalBudgeted: 'Заплановано',
      totalSpent: 'Витрачено',
    },
    row: {
      editBudget: 'Бюджет: {{amount}}',
      amountLabel: 'Сума',
      save: 'Зберегти',
      cancel: 'Скасувати',
      errorInvalidAmount: 'Некоректна сума',
      progressLabel: 'Прогрес для {{name}}',
      spent: 'Витрачено',
      remaining: 'Залишок',
    },
  },
};

describe('PlannerPageComponent', () => {
  let httpController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PlannerPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  function flushCategories(
    fixture: ReturnType<typeof TestBed.createComponent<PlannerPageComponent>>,
  ): void {
    httpController.expectOne('/api/budget/categories').flush([
      { id: 'c1', name: 'Їжа' },
      { id: 'c2', name: 'Транспорт' },
    ]);
    fixture.detectChanges();
  }

  it('loads categories and the current month summary on init', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();

    flushCategories(fixture);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-07', categories: [] });

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('re-fetches the summary for the new month when navigating months', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    flushCategories(fixture);
    const initialMonth = httpController.expectOne(
      (candidate) => candidate.url === '/api/budget/summary',
    );
    const requestedMonth = initialMonth.request.params.get('month');
    initialMonth.flush({ month: requestedMonth, categories: [] });

    fixture.componentInstance['goToNextMonth']();
    fixture.detectChanges();

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/summary' &&
          candidate.params.get('month') !== requestedMonth,
      )
      .flush({ month: 'next', categories: [] });
  });

  it('exits edit mode when navigating to a different month', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    flushCategories(fixture);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({
        month: '2026-07',
        categories: [
          {
            categoryId: 'c1',
            budgeted: { amount: '10000', currency: 'UAH' },
            spent: { amount: '0', currency: 'UAH' },
            remaining: { amount: '10000', currency: 'UAH' },
          },
        ],
      });
    fixture.detectChanges();

    fixture.componentInstance['onStartEdit']('c1');
    expect(fixture.componentInstance['editingCategoryId']()).toBe('c1');

    fixture.componentInstance['goToNextMonth']();
    fixture.detectChanges();

    expect(fixture.componentInstance['editingCategoryId']()).toBeNull();

    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-08', categories: [] });
  });

  it('renders budget-only and spend-only categories distinctly (union semantics)', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    flushCategories(fixture);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({
        month: '2026-07',
        categories: [
          {
            categoryId: 'c1',
            budgeted: { amount: '10000', currency: 'UAH' },
            spent: { amount: '0', currency: 'UAH' },
            remaining: { amount: '10000', currency: 'UAH' },
          },
          {
            categoryId: 'c2',
            budgeted: { amount: '0', currency: 'UAH' },
            spent: { amount: '5000', currency: 'UAH' },
            remaining: { amount: '-5000', currency: 'UAH' },
          },
        ],
      });
    fixture.detectChanges();

    const rows = fixture.componentInstance['rows']();
    expect(rows.find((r) => r.categoryId === 'c1')?.spent.isZero()).toBe(true);
    expect(rows.find((r) => r.categoryId === 'c2')?.budgeted.isZero()).toBe(
      true,
    );
    expect(fixture.componentInstance['isEmpty']()).toBe(false);
  });

  it('shows the empty-month prompt when no budgets or spend exist', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    flushCategories(fixture);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-07', categories: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance['isEmpty']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Бюджети на цей місяць ще не встановлено.',
    );
  });

  it('drives the inline upsert flow: start edit, save, PUT, then re-fetches the summary', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    flushCategories(fixture);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-07', categories: [] });
    fixture.detectChanges();

    fixture.componentInstance['onStartEdit']('c1');
    fixture.detectChanges();

    const row = fixture.debugElement.queryAll(
      By.css('lib-planner-category-row'),
    )[0];
    const input = row.query(By.css('input')).nativeElement as HTMLInputElement;
    input.value = '150,00';
    input.dispatchEvent(new Event('input'));
    row.query(By.css('form')).triggerEventHandler('submit');

    const putRequest = httpController.expectOne(
      (candidate) =>
        candidate.url === '/api/budget/monthly-budgets' &&
        candidate.method === 'PUT',
    );
    expect(putRequest.request.body).toEqual({
      categoryId: 'c1',
      month: '2026-07',
      amountMinorUnits: 15000,
    });
    putRequest.flush({
      id: 'mb1',
      categoryId: 'c1',
      month: '2026-07',
      amount: { amount: '15000', currency: 'UAH' },
    });
    fixture.detectChanges();

    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({
        month: '2026-07',
        categories: [
          {
            categoryId: 'c1',
            budgeted: { amount: '15000', currency: 'UAH' },
            spent: { amount: '0', currency: 'UAH' },
            remaining: { amount: '15000', currency: 'UAH' },
          },
        ],
      });
    fixture.detectChanges();

    expect(fixture.componentInstance['editingCategoryId']()).toBeNull();
  });

  it('keeps the row in edit mode and surfaces the error when the upsert fails', () => {
    const fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    flushCategories(fixture);
    httpController
      .expectOne((candidate) => candidate.url === '/api/budget/summary')
      .flush({ month: '2026-07', categories: [] });
    fixture.detectChanges();

    fixture.componentInstance['onStartEdit']('c1');
    fixture.detectChanges();

    const row = fixture.debugElement.queryAll(
      By.css('lib-planner-category-row'),
    )[0];
    const input = row.query(By.css('input')).nativeElement as HTMLInputElement;
    input.value = '150,00';
    input.dispatchEvent(new Event('input'));
    row.query(By.css('form')).triggerEventHandler('submit');

    const putRequest = httpController.expectOne(
      (candidate) =>
        candidate.url === '/api/budget/monthly-budgets' &&
        candidate.method === 'PUT',
    );
    putRequest.flush(
      { code: 'DOMAIN_CONFLICT_ERROR', message: 'Не вдалося зберегти бюджет' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    // Row must stay in edit mode with the error surfaced, and must NOT
    // trigger a summary re-fetch (the success-only refetch branch).
    expect(fixture.componentInstance['editingCategoryId']()).toBe('c1');
    expect(fixture.nativeElement.textContent).toContain(
      'Не вдалося зберегти бюджет',
    );
    httpController.expectNone(
      (candidate) => candidate.url === '/api/budget/summary',
    );
  });
});
