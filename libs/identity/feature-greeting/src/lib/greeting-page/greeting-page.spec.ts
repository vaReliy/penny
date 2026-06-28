import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GreetingPageComponent } from './greeting-page.js';
import { IdentityService } from 'identity-data-access';

describe('GreetingPageComponent', () => {
  let fixture: ComponentFixture<GreetingPageComponent>;
  let mockIdentityService: { getHello: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockIdentityService = { getHello: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [GreetingPageComponent],
      providers: [{ provide: IdentityService, useValue: mockIdentityService }],
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(GreetingPageComponent);
    fixture.detectChanges();
  }

  it('shows loading text when getHello() never emits', () => {
    mockIdentityService.getHello.mockReturnValue(NEVER);

    createComponent();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Loading...');
  });

  it('shows message when getHello() emits a response', async () => {
    mockIdentityService.getHello.mockReturnValue(
      of({ message: 'Hello, Test' }),
    );

    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Hello, Test');
  });

  it('shows error text when getHello() throws', async () => {
    mockIdentityService.getHello.mockReturnValue(
      throwError(() => new Error('oops')),
    );

    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toContain('Failed to load greeting');
  });
});
