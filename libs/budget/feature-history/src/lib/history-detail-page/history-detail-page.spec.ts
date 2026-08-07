import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HistoryDetailPageComponent } from './history-detail-page';

const UK_TRANSLATIONS = {};
const NOT_FOUND_ERROR_TEXT = 'Не знайдено.';
const BUDGET_UK_TRANSLATIONS = {
  errors: {
    notFound: NOT_FOUND_ERROR_TEXT,
  },
  history: {
    detail: {
      back: 'Назад',
      title: 'Деталі операції',
      amountLabel: 'Сума',
      categoryLabel: 'Категорія',
      dateLabel: 'Дата',
      descriptionLabel: 'Опис',
      recordedByLabel: 'Записав(-ла)',
    },
  },
};

describe('HistoryDetailPageComponent', () => {
  let paramMapSubject: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let httpController: HttpTestingController;

  beforeEach(async () => {
    paramMapSubject = new BehaviorSubject(convertToParamMap({ id: 't1' }));

    await TestBed.configureTestingModule({
      imports: [
        HistoryDetailPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
            snapshot: { queryParams: { period: 'day' } },
          },
        },
      ],
    }).compileComponents();

    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  async function detectAndStabilize(fixture: {
    detectChanges: () => void;
    whenStable: () => Promise<unknown>;
  }): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads the transaction by route id and renders its fields', async () => {
    const fixture = TestBed.createComponent(HistoryDetailPageComponent);
    fixture.detectChanges();

    httpController
      .expectOne('/api/budget/categories')
      .flush([{ id: 'c1', name: 'Їжа' }]);
    httpController.expectOne('/api/budget/transactions/t1').flush({
      id: 't1',
      accountId: 'a1',
      categoryId: 'c1',
      type: 'expense',
      amount: { amount: '15000', currency: 'UAH' },
      date: '2026-07-27',
      description: 'Обід',
      createdBy: 'u1',
      createdAt: '2026-07-27T00:00:00.000Z',
    });

    await detectAndStabilize(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Їжа');
    expect(text).toContain('Обід');
    expect(text).toContain('u1');
  });

  it('carries the route snapshot query params into the back link', async () => {
    const fixture = TestBed.createComponent(HistoryDetailPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController.expectOne('/api/budget/transactions/t1').flush({
      id: 't1',
      accountId: 'a1',
      categoryId: 'c1',
      type: 'expense',
      amount: { amount: '15000', currency: 'UAH' },
      date: '2026-07-27',
      createdBy: 'u1',
      createdAt: '2026-07-27T00:00:00.000Z',
    });
    await detectAndStabilize(fixture);

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toContain('period=day');
  });

  it('surfaces a detail load error', async () => {
    const fixture = TestBed.createComponent(HistoryDetailPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne('/api/budget/transactions/t1')
      .flush('not found', { status: 404, statusText: 'Not Found' });

    await detectAndStabilize(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(NOT_FOUND_ERROR_TEXT);
  });

  it('surfaces a 500 from the detail endpoint without throwing', async () => {
    const fixture = TestBed.createComponent(HistoryDetailPageComponent);
    fixture.detectChanges();
    httpController.expectOne('/api/budget/categories').flush([]);
    httpController
      .expectOne('/api/budget/transactions/t1')
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });

    await detectAndStabilize(fixture);

    expect(
      fixture.componentInstance['transactionStore'].detailError()?.kind,
    ).toBe('UNKNOWN');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
  });
});
