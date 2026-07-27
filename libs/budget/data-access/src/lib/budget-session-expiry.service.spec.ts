import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetSessionExpiryService } from './budget-session-expiry.service.js';

describe('BudgetSessionExpiryService', () => {
  let service: BudgetSessionExpiryService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BudgetSessionExpiryService, provideRouter([])],
    });

    service = TestBed.inject(BudgetSessionExpiryService);
    router = TestBed.inject(Router);
  });

  it('navigates to /login', () => {
    const navigateSpy = vi
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    service.redirectToLogin();

    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
