import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SESSION_LOGOUT } from 'shared-web-shell-data';
import { NoWorkspacePageComponent } from './no-workspace-page';

const MESSAGE =
  'Вас ще не додано до жодного робочого простору. Зверніться до адміністратора.';

describe('NoWorkspacePageComponent', () => {
  let logoutSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    logoutSpy = vi.fn(() => of(undefined));

    await TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            uk: {
              shell: {
                noWorkspace: {
                  message: MESSAGE,
                  logout: 'Вийти',
                },
              },
            },
          },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideRouter([
          { path: 'no-workspace', component: NoWorkspacePageComponent },
          { path: 'login', children: [] },
        ]),
        { provide: SESSION_LOGOUT, useValue: logoutSpy },
      ],
    }).compileComponents();
  });

  it('renders the Ukrainian no-workspace copy', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no-workspace', NoWorkspacePageComponent);
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain(MESSAGE);
  });

  it('calls the logout action and navigates to /login', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no-workspace', NoWorkspacePageComponent);
    harness.detectChanges();

    const button = harness.routeNativeElement?.querySelector('button');
    button?.click();

    expect(logoutSpy).toHaveBeenCalledTimes(1);

    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/login');
  });
});
