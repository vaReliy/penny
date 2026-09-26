import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppShellComponent } from './app-shell';
import { CurrentWorkspace, SESSION_LOGOUT } from 'shared-web-shell-data';

describe('AppShellComponent', () => {
  let logoutSpy: ReturnType<typeof vi.fn>;
  let httpController: HttpTestingController;

  beforeEach(async () => {
    logoutSpy = vi.fn(() => of(undefined));

    await TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            uk: {
              shell: {
                brand: 'Penny',
                nav: {
                  label: 'Навігація',
                  account: 'Рахунок',
                  history: 'Історія',
                  planner: 'Планувальник',
                  records: 'Записи',
                },
                profile: { menuLabel: 'Меню профілю', logout: 'Вийти' },
              },
            },
          },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: '',
            component: AppShellComponent,
            children: [
              {
                path: 'w/:workspaceId',
                children: [
                  { path: 'account', children: [] },
                  { path: 'history', children: [] },
                  { path: 'planner', children: [] },
                  { path: 'records', children: [] },
                ],
              },
            ],
          },
          { path: 'login', children: [] },
        ]),
        { provide: SESSION_LOGOUT, useValue: logoutSpy },
      ],
    }).compileComponents();

    TestBed.inject(CurrentWorkspace).setCurrentId('ws1');
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('renders all 4 nav sections', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/ws1/account', AppShellComponent);
    harness.detectChanges();

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Рахунок');
    expect(text).toContain('Історія');
    expect(text).toContain('Планувальник');
    expect(text).toContain('Записи');
  });

  it('renders exactly 4 nav items in each nav region (desktop + mobile)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/ws1/account', AppShellComponent);
    harness.detectChanges();

    const navs = harness.routeNativeElement?.querySelectorAll('nav') ?? [];
    expect(navs.length).toBe(2);

    for (const nav of Array.from(navs)) {
      const links = nav.querySelectorAll('a');
      expect(links.length).toBe(4);
    }
  });

  it('nav links point to /w/<currentId>/{account,history,planner,records}', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/ws1/account', AppShellComponent);
    harness.detectChanges();

    const nav = harness.routeNativeElement?.querySelector('nav');
    const hrefs = Array.from(nav?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual([
      '/w/ws1/account',
      '/w/ws1/history',
      '/w/ws1/planner',
      '/w/ws1/records',
    ]);
  });

  it('marks the active route on the matching nav link', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/ws1/account', AppShellComponent);
    harness.detectChanges();

    const activeLink = harness.routeNativeElement?.querySelector(
      'a[aria-current="page"]',
    ) as HTMLAnchorElement | null;

    expect(activeLink?.textContent).toContain('Рахунок');
  });

  it('applies the primary-gradient fill with dark on-primary text to the active nav link (ADR-009 contrast rule)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/ws1/account', AppShellComponent);
    harness.detectChanges();

    const activeLinks = harness.routeNativeElement?.querySelectorAll(
      'a[aria-current="page"]',
    ) as NodeListOf<HTMLAnchorElement> | undefined;

    expect(activeLinks?.length).toBe(2);
    for (const link of Array.from(activeLinks ?? [])) {
      expect(link.className).toContain('from-primary-from');
      expect(link.className).toContain('to-primary-to');
      expect(link.className).toContain('text-on-primary');
    }
  });

  it('calls the session logout and navigates to /login', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/w/ws1/account',
      AppShellComponent,
    );
    harness.detectChanges();

    (component as unknown as { onLogout: () => void }).onLogout();

    expect(logoutSpy).toHaveBeenCalledTimes(1);

    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/login');
  });

  it('fetches workspaces and sets current when the shell mounts with no current workspace (e.g. entering via greeting)', async () => {
    // The outer beforeEach pre-sets currentId; start a fresh module without it.
    TestBed.resetTestingModule();
    logoutSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { uk: { shell: { profile: { menuLabel: 'Меню профілю' } } } },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: '',
            component: AppShellComponent,
            children: [
              {
                path: 'w/:workspaceId',
                children: [{ path: 'account', children: [] }],
              },
            ],
          },
        ]),
        { provide: SESSION_LOGOUT, useValue: logoutSpy },
      ],
    }).compileComponents();

    const controller = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', AppShellComponent);
    harness.detectChanges();

    controller.expectOne('/api/workspaces').flush([
      {
        id: 'a',
        name: 'Family',
        role: 'admin',
        grantedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    harness.detectChanges();

    expect(TestBed.inject(CurrentWorkspace).currentId()).toBe('a');
    controller.verify();
  });
});
