import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RecordsPageComponent } from './records-page';

const UK_TRANSLATIONS = { common: { loading: 'Завантаження...' } };
const BUDGET_UK_TRANSLATIONS = {
  records: {
    page: { title: 'Записи' },
    transactionForm: {
      title: 'Додати подію',
      typeLabel: 'Оберіть тип',
      typeIncome: 'Прибуток',
      typeExpense: 'Витрата',
      categoryLabel: 'Оберіть категорію',
      categoryPlaceholder: 'Оберіть категорію',
      noCategoriesHint:
        'Немає активних категорій. Спочатку створіть категорію нижче.',
      amountLabel: 'Введіть суму',
      dateLabel: 'Дата',
      descriptionLabel: 'Опис',
      submit: 'Додати',
      success: 'Подію успішно додано!',
      errorRequired: 'Поле не може бути пустим.',
      errorMaxLength: 'Довжина поля має бути не більшою за {{max}} символів.',
      errorInvalidAmount: 'Введіть коректну суму, напр. 123,45',
    },
    categoryManager: {
      title: 'Категорії',
      empty: 'Категорій ще немає.',
      showArchived: 'Показати архівні',
      archivedBadge: 'архівна',
      createNameLabel: 'Введіть назву',
      createSubmit: 'Додати категорію',
      createSuccess: 'Категорію додано!',
      renameAction: 'Перейменувати',
      renameSubmit: 'Зберегти',
      renameCancel: 'Скасувати',
      renameSuccess: 'Категорію оновлено!',
      archiveAction: 'Архівувати',
      archiveConfirmBody: 'Архівувати категорію «{{name}}»?',
      archiveConfirm: 'Архівувати',
      archiveCancel: 'Скасувати',
      archiveSuccess: 'Категорію заархівовано.',
      errorRequired: 'Поле не може бути пустим.',
      errorMaxLength: 'Довжина поля має бути не більшою за {{max}} символів.',
    },
  },
};

describe('RecordsPageComponent', () => {
  let fixture: ComponentFixture<RecordsPageComponent>;
  let httpController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RecordsPageComponent,
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

  it('loads categories and balance once on init and renders both sections', async () => {
    fixture = TestBed.createComponent(RecordsPageComponent);
    fixture.detectChanges();

    httpController
      .expectOne('/api/budget/categories')
      .flush([{ id: 'c1', name: 'Продукти' }]);
    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '0', currency: 'UAH' },
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Записи');
    expect(el.querySelector('lib-transaction-form')).not.toBeNull();
    expect(el.querySelector('lib-category-manager')).not.toBeNull();
  });
});
