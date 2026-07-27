import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CategoryClient } from './category.client.js';

describe('CategoryClient', () => {
  let client: CategoryClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CategoryClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(CategoryClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  describe('list', () => {
    it('sends GET to /api/budget/categories with withCredentials', () => {
      let result: readonly { id: string }[] | undefined;
      client.list().subscribe((categories) => (result = categories));

      const req = httpController.expectOne('/api/budget/categories');
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);

      req.flush([
        { id: 'c1', name: 'Groceries' },
        { id: 'c2', name: 'Rent', archivedAt: '2026-01-15T00:00:00.000Z' },
      ]);

      expect(result).toHaveLength(2);
      expect(result?.[1]).toMatchObject({ id: 'c2', name: 'Rent' });
    });

    it('converts archivedAt from an ISO string to a Date', () => {
      let result: readonly { archivedAt?: Date }[] | undefined;
      client.list().subscribe((categories) => (result = categories));

      const req = httpController.expectOne('/api/budget/categories');
      req.flush([
        { id: 'c1', name: 'Rent', archivedAt: '2026-01-15T00:00:00.000Z' },
      ]);

      expect(result?.[0]?.archivedAt).toBeInstanceOf(Date);
      expect(result?.[0]?.archivedAt?.toISOString()).toBe(
        '2026-01-15T00:00:00.000Z',
      );
    });

    it('omits archivedAt when the category is not archived', () => {
      let result: readonly { archivedAt?: Date }[] | undefined;
      client.list().subscribe((categories) => (result = categories));

      const req = httpController.expectOne('/api/budget/categories');
      req.flush([{ id: 'c1', name: 'Groceries' }]);

      expect(result?.[0]?.archivedAt).toBeUndefined();
    });
  });

  describe('create', () => {
    it('sends POST with the request body', () => {
      client.create({ name: 'Utilities' }).subscribe();

      const req = httpController.expectOne('/api/budget/categories');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Utilities' });
      req.flush({ id: 'c3', name: 'Utilities' });
    });
  });

  describe('update', () => {
    it('sends PATCH to /api/budget/categories/:id', () => {
      client.update('c1', { name: 'Groceries & Household' }).subscribe();

      const req = httpController.expectOne('/api/budget/categories/c1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'Groceries & Household' });
      req.flush({ id: 'c1', name: 'Groceries & Household' });
    });
  });

  describe('archive', () => {
    it('sends POST to /api/budget/categories/:id/archive with a null body', () => {
      client.archive('c1').subscribe();

      const req = httpController.expectOne('/api/budget/categories/c1/archive');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush({
        id: 'c1',
        name: 'Groceries',
        archivedAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });
});
