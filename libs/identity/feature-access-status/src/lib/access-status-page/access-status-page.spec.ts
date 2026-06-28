import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessStatusPageComponent } from './access-status-page.js';
import { IdentityService } from 'identity-data-access';

describe('AccessStatusPageComponent', () => {
  let fixture: ComponentFixture<AccessStatusPageComponent>;
  let mockIdentityService: { getMe: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockIdentityService = { getMe: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AccessStatusPageComponent],
      providers: [{ provide: IdentityService, useValue: mockIdentityService }],
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(AccessStatusPageComponent);
    fixture.detectChanges();
  }

  it('shows loading text when getMe() never emits', () => {
    mockIdentityService.getMe.mockReturnValue(NEVER);
    createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Loading...');
  });

  it('shows pending text when status is pending', async () => {
    mockIdentityService.getMe.mockReturnValue(of({ status: 'pending' }));
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toContain('awaiting approval');
  });

  it('shows rejected text when status is rejected', async () => {
    mockIdentityService.getMe.mockReturnValue(of({ status: 'rejected' }));
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toContain('declined');
  });

  it('shows loading text on error (null fallback)', async () => {
    mockIdentityService.getMe.mockReturnValue(
      throwError(() => new Error('oops')),
    );
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Loading...');
  });
});
