import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { CategoryStore } from 'budget-data-access';
import { CategoryManagerComponent } from './category-manager';

const UK_TRANSLATIONS = { common: { loading: 'Завантаження...' } };
const BUDGET_UK_TRANSLATIONS = {
  records: {
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

describe('CategoryManagerComponent', () => {
  let fixture: ComponentFixture<CategoryManagerComponent>;
  let httpController: HttpTestingController;
  let categoryStore: CategoryStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CategoryManagerComponent,
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
    categoryStore = TestBed.inject(CategoryStore);
  });

  afterEach(() => {
    httpController.verify();
  });

  function loadCategories(
    categories: readonly { id: string; name: string; archivedAt?: string }[],
  ): void {
    categoryStore.load();
    httpController.expectOne('/api/budget/categories').flush(categories);
  }

  it('hides archived categories by default and shows them once the toggle is checked', async () => {
    fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    loadCategories([
      { id: 'c1', name: 'Продукти' },
      { id: 'c2', name: 'Стара', archivedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    let el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Продукти');
    expect(el.textContent).not.toContain('Стара');

    const checkbox = el.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();

    el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Стара');
  });

  it('creates a category and shows a success confirmation, resetting the form', async () => {
    fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    loadCategories([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.createForm.controls.name.setValue('Транспорт');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    const req = httpController.expectOne('/api/budget/categories');
    expect(req.request.body).toEqual({ name: 'Транспорт' });
    req.flush({ id: 'c3', name: 'Транспорт' });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.createForm.controls.name.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Категорію додано!');
  });

  it('shows a required-field message when submitting an empty category name', async () => {
    fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    loadCategories([]);
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Поле не може бути пустим.',
    );
    httpController.expectNone('/api/budget/categories');
  });

  it('renames a category via the rename affordance', async () => {
    fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    loadCategories([{ id: 'c1', name: 'Продукти' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.startRename({ id: 'c1', name: 'Продукти' });
    fixture.detectChanges();

    component.renameForm.controls.name.setValue('Їжа');
    component.onRenameSubmit('c1');

    const req = httpController.expectOne('/api/budget/categories/c1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Їжа' });
    req.flush({ id: 'c1', name: 'Їжа' });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.editingId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Їжа');
    expect(fixture.nativeElement.textContent).toContain('Категорію оновлено!');
  });

  it('surfaces a failed category-create next to the create form without discarding the already-loaded list', async () => {
    fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    loadCategories([{ id: 'c1', name: 'Продукти' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.createForm.controls.name.setValue('Транспорт');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));

    httpController
      .expectOne('/api/budget/categories')
      .flush(
        { code: 'VALIDATION_ERROR', message: 'name already in use' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('name already in use');
    // The already-loaded category list must stay visible — a create failure
    // never blanks/resets sibling data.
    expect(fixture.nativeElement.textContent).toContain('Продукти');
  });

  it('archives a category only after the confirm step, and surfaces a failed archive on the confirm control without discarding the list', async () => {
    fixture = TestBed.createComponent(CategoryManagerComponent);
    fixture.detectChanges();
    loadCategories([{ id: 'c1', name: 'Продукти' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.requestArchive('c1');
    fixture.detectChanges();

    httpController.expectNone('/api/budget/categories/c1/archive');

    component.confirmArchive('c1');
    httpController
      .expectOne('/api/budget/categories/c1/archive')
      .flush(
        {
          code: 'DOMAIN_CONFLICT_ERROR',
          message: 'Category is already archived.',
        },
        { status: 409, statusText: 'Conflict' },
      );

    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Category is already archived.');
    // The confirm dialog and the category itself stay visible after a
    // failed archive — sibling data is never discarded.
    expect(component.pendingArchiveId()).toBe('c1');
    expect(fixture.nativeElement.textContent).toContain('Продукти');
  });
});
