import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AccessStatusPageComponent } from './access-status-page.js';
import { IdentityService } from 'identity-data-access';

const UK_TRANSLATIONS = { common: { loading: 'Завантаження...' } };
const IDENTITY_UK_TRANSLATIONS = {
  accessStatus: {
    pending:
      'Ваш доступ очікує підтвердження. Адміністратор незабаром розгляне ваш запит.',
    rejected:
      'У доступі відмовлено. Якщо ви вважаєте це помилкою, зверніться в підтримку.',
  },
};

describe('AccessStatusPageComponent', () => {
  let fixture: ComponentFixture<AccessStatusPageComponent>;
  let mockIdentityService: { getMe: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockIdentityService = { getMe: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AccessStatusPageComponent,
        TranslocoTestingModule.forRoot({
          langs: {
            uk: UK_TRANSLATIONS,
            'identity/uk': IDENTITY_UK_TRANSLATIONS,
          },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [{ provide: IdentityService, useValue: mockIdentityService }],
    }).compileComponents();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(AccessStatusPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows loading text when getMe() never emits', async () => {
    mockIdentityService.getMe.mockReturnValue(NEVER);
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Завантаження...');
  });

  it('shows pending text when status is pending', async () => {
    mockIdentityService.getMe.mockReturnValue(of({ status: 'pending' }));
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toContain('очікує підтвердження');
  });

  it('shows rejected text when status is rejected', async () => {
    mockIdentityService.getMe.mockReturnValue(of({ status: 'rejected' }));
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toContain('відмовлено');
  });

  it('shows loading text on error (null fallback)', async () => {
    mockIdentityService.getMe.mockReturnValue(
      throwError(() => new Error('oops')),
    );
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Завантаження...');
  });
});
