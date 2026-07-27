import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CategoryStore } from './category.store.js';
import { BudgetApiErrorKind } from './budget-api-error.js';

describe('CategoryStore', () => {
  let store: CategoryStore;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CategoryStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    store = TestBed.inject(CategoryStore);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('starts with empty data, not loading, no error', () => {
    expect(store.data()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets loading, then populates data and clears loading', () => {
    store.load();
    expect(store.loading()).toBe(true);

    httpController
      .expectOne('/api/budget/categories')
      .flush([{ id: 'c1', name: 'Groceries' }]);

    expect(store.loading()).toBe(false);
    expect(store.data()).toEqual([{ id: 'c1', name: 'Groceries' }]);
  });

  it('create() appends the created category to data', () => {
    store.load();
    httpController.expectOne('/api/budget/categories').flush([]);

    store.create({ name: 'Utilities' });
    httpController
      .expectOne('/api/budget/categories')
      .flush({ id: 'c1', name: 'Utilities' });

    expect(store.data()).toEqual([{ id: 'c1', name: 'Utilities' }]);
  });

  it('update() replaces the matching category in data', () => {
    store.load();
    httpController
      .expectOne('/api/budget/categories')
      .flush([{ id: 'c1', name: 'Groceries' }]);

    store.update('c1', { name: 'Groceries & Household' });
    httpController
      .expectOne('/api/budget/categories/c1')
      .flush({ id: 'c1', name: 'Groceries & Household' });

    expect(store.data()).toEqual([{ id: 'c1', name: 'Groceries & Household' }]);
  });

  it('archive() replaces the matching category with its archived form', () => {
    store.load();
    httpController
      .expectOne('/api/budget/categories')
      .flush([{ id: 'c1', name: 'Groceries' }]);

    store.archive('c1');
    httpController
      .expectOne('/api/budget/categories/c1/archive')
      .flush({
        id: 'c1',
        name: 'Groceries',
        archivedAt: '2026-07-27T00:00:00.000Z',
      });

    expect(store.data()[0]?.archivedAt).toBeInstanceOf(Date);
  });

  it('maps a failed load() into the error signal without throwing', () => {
    store.load();
    httpController
      .expectOne('/api/budget/categories')
      .flush(
        { code: 'VALIDATION_ERROR', message: 'bad request', statusCode: 400 },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.loading()).toBe(false);
    expect(store.error()?.kind).toBe(BudgetApiErrorKind.VALIDATION);
    expect(store.data()).toEqual([]);
  });
});
