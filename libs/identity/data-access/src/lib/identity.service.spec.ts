import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IdentityService } from './identity.service.js';

describe('IdentityService', () => {
  let service: IdentityService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IdentityService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(IdentityService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  describe('submitTelegramLogin', () => {
    it('sends POST to /auth/telegram', () => {
      const payload = {
        id: 123456,
        firstName: 'Alice',
        authDate: 1700000000,
        hash: 'abc123hash',
      };

      service.submitTelegramLogin(payload).subscribe();

      const req = httpController.expectOne('/auth/telegram');
      expect(req.request.method).toBe('POST');
      req.flush({ status: 'ok' });
    });

    it('sends request with withCredentials: true', () => {
      const payload = {
        id: 123456,
        firstName: 'Alice',
        authDate: 1700000000,
        hash: 'abc123hash',
      };

      service.submitTelegramLogin(payload).subscribe();

      const req = httpController.expectOne('/auth/telegram');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ status: 'ok' });
    });

    it('sends the payload as the request body', () => {
      const payload = {
        id: 999,
        firstName: 'Bob',
        lastName: 'Builder',
        authDate: 1700001000,
        hash: 'deadbeef',
      };

      service.submitTelegramLogin(payload).subscribe();

      const req = httpController.expectOne('/auth/telegram');
      expect(req.request.body).toEqual(payload);
      req.flush({ status: 'ok' });
    });
  });

  describe('getMe', () => {
    it('sends GET to /auth/me', () => {
      service.getMe().subscribe();

      const req = httpController.expectOne('/auth/me');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'user-1', telegramId: 123456 });
    });

    it('sends request with withCredentials: true', () => {
      service.getMe().subscribe();

      const req = httpController.expectOne('/auth/me');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ id: 'user-1', telegramId: 123456 });
    });
  });

  describe('logout', () => {
    it('sends POST to /auth/logout', () => {
      service.logout().subscribe();

      const req = httpController.expectOne('/auth/logout');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('sends request with withCredentials: true', () => {
      service.logout().subscribe();

      const req = httpController.expectOne('/auth/logout');
      expect(req.request.withCredentials).toBe(true);
      req.flush(null);
    });
  });
});
