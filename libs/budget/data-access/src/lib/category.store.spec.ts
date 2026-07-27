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
    expect(store.listLoading()).toBe(false);
    expect(store.listError()).toBeNull();
  });

  it('load() sets listLoading, then populates data and clears listLoading', () => {
    store.load();
    expect(store.listLoading()).toBe(true);

    httpController
      .expectOne('/api/budget/categories')
      .flush([{ id: 'c1', name: 'Groceries' }]);

    expect(store.listLoading()).toBe(false);
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
    httpController.expectOne('/api/budget/categories/c1/archive').flush({
      id: 'c1',
      name: 'Groceries',
      archivedAt: '2026-07-27T00:00:00.000Z',
    });

    expect(store.data()[0]?.archivedAt).toBeInstanceOf(Date);
  });

  it('maps a failed load() into the listError signal without throwing', () => {
    store.load();
    httpController
      .expectOne('/api/budget/categories')
      .flush(
        { code: 'VALIDATION_ERROR', message: 'bad request', statusCode: 400 },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.listLoading()).toBe(false);
    expect(store.listError()?.kind).toBe(BudgetApiErrorKind.VALIDATION);
    expect(store.data()).toEqual([]);
  });

  it('createLoading stays true while a concurrent list() request resolves first', () => {
    store.create({ name: 'Utilities' });
    store.load();

    expect(store.createLoading()).toBe(true);
    expect(store.listLoading()).toBe(true);

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/categories' &&
          candidate.method === 'GET',
      )
      .flush([]);

    expect(store.listLoading()).toBe(false);
    expect(store.createLoading()).toBe(true);

    httpController
      .expectOne(
        (candidate) =>
          candidate.url === '/api/budget/categories' &&
          candidate.method === 'POST',
      )
      .flush({ id: 'c1', name: 'Utilities' });

    expect(store.createLoading()).toBe(false);
  });

  it('an error on create() leaves update()/archive() error signals null', () => {
    store.create({ name: 'Utilities' });
    store.update('c1', { name: 'Groceries & Household' });

    httpController
      .expectOne('/api/budget/categories')
      .flush('create failed', { status: 500, statusText: 'Server Error' });

    expect(store.createError()).not.toBeNull();
    expect(store.updateError()).toBeNull();
    expect(store.archiveError()).toBeNull();

    httpController
      .expectOne('/api/budget/categories/c1')
      .flush({ id: 'c1', name: 'Groceries & Household' });

    expect(store.updateError()).toBeNull();
  });
});
