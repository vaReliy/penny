import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { GreetingPageComponent } from './greeting-page.js';
import { IdentityService } from 'identity-data-access';

const UK_TRANSLATIONS = { common: { loading: 'Завантаження...' } };
const IDENTITY_UK_TRANSLATIONS = {
  greeting: { error: 'Не вдалося завантажити привітання. Спробуйте ще раз.' },
};

describe('GreetingPageComponent', () => {
  let fixture: ComponentFixture<GreetingPageComponent>;
  let mockIdentityService: { getHello: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockIdentityService = { getHello: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        GreetingPageComponent,
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
    fixture = TestBed.createComponent(GreetingPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows loading text initially (startWith loading state)', async () => {
    mockIdentityService.getHello.mockReturnValue(NEVER);
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Завантаження...');
  });

  it('shows message when getHello() emits a response', async () => {
    mockIdentityService.getHello.mockReturnValue(
      of({ greeting: 'Hello, Test', telegramId: '123456' }),
    );
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Hello, Test');
  });

  it('shows error text when getHello() throws', async () => {
    mockIdentityService.getHello.mockReturnValue(
      throwError(() => new Error('oops')),
    );
    await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toContain(
      'Не вдалося завантажити привітання',
    );
  });
});
