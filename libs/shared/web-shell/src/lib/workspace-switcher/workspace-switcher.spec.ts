import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceSwitcherComponent } from './workspace-switcher';
import { CurrentWorkspace } from 'shared-web-shell-data';

const langs = {
  uk: {
    shell: {
      workspace: {
        triggerLabel: 'Робочий простір: {{name}}',
      },
    },
  },
};

async function setUp(
  routeSegments: {
    path: string;
    children?: { path: string; children: [] }[];
  }[],
) {
  await TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs,
        translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
      }),
    ],
    providers: [
      provideRouter([
        {
          path: '',
          component: WorkspaceSwitcherComponent,
          children: routeSegments,
        },
      ]),
    ],
  }).compileComponents();
}

describe('WorkspaceSwitcherComponent', () => {
  let currentWorkspace: CurrentWorkspace;

  beforeEach(async () => {
    await setUp([
      {
        path: 'w/:workspaceId',
        children: [
          { path: 'planner', children: [] },
          { path: 'history', children: [] },
        ],
      },
    ]);
    currentWorkspace = TestBed.inject(CurrentWorkspace);
  });

  it('renders the current workspace name', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/planner', WorkspaceSwitcherComponent);
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Family');
  });

  it('with 2 workspaces, the menu lists both and marks the current one', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
      { id: 'b', name: 'Business', role: 'member', grantedAt: '2026-01-02' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/planner', WorkspaceSwitcherComponent);
    harness.detectChanges();

    const trigger = harness.routeNativeElement?.querySelector(
      'button',
    ) as HTMLButtonElement;
    trigger.click();
    harness.detectChanges();

    const items = document.body.querySelectorAll(
      '[cdkmenuitem], button[cdkMenuItem]',
    );
    const labels = Array.from(document.body.querySelectorAll('button')).map(
      (b) => b.textContent?.trim(),
    );
    expect(labels).toContain('Family');
    expect(labels).toContain('Business');

    const current = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-current') === 'true',
    );
    expect(current?.textContent?.trim()).toBe('Family');
    expect(items.length).toBeGreaterThan(0);
  });

  it('selecting the other workspace on /w/a/planner navigates to /w/b/planner', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
      { id: 'b', name: 'Business', role: 'member', grantedAt: '2026-01-02' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/planner', WorkspaceSwitcherComponent);
    harness.detectChanges();

    harness.routeNativeElement
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    harness.detectChanges();

    const businessItem = Array.from(
      document.body.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Business') as HTMLButtonElement;
    businessItem.click();
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/w/b/planner');
  });

  it('selecting on /w/a/history/tx1 navigates to /w/b/history (drops the id)', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
      { id: 'b', name: 'Business', role: 'member', grantedAt: '2026-01-02' },
    ]);
    currentWorkspace.setCurrentId('a');

    await TestBed.resetTestingModule();
    await setUp([
      {
        path: 'w/:workspaceId',
        children: [
          {
            path: 'history',
            children: [{ path: ':txId', children: [] }] as never,
          },
        ],
      },
    ]);
    currentWorkspace = TestBed.inject(CurrentWorkspace);
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
      { id: 'b', name: 'Business', role: 'member', grantedAt: '2026-01-02' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/history/tx1', WorkspaceSwitcherComponent);
    harness.detectChanges();

    harness.routeNativeElement
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    harness.detectChanges();

    const businessItem = Array.from(
      document.body.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Business') as HTMLButtonElement;
    businessItem.click();
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/w/b/history');
  });

  it('with 1 workspace, no menu items are rendered', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/planner', WorkspaceSwitcherComponent);
    harness.detectChanges();

    harness.routeNativeElement
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    harness.detectChanges();

    expect(document.body.querySelector('[cdkmenu]')).toBeNull();
  });

  it('the trigger has the Робочий простір aria-label', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/planner', WorkspaceSwitcherComponent);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const trigger = harness.routeNativeElement?.querySelector('button');
    expect(trigger?.getAttribute('aria-label')).toBe('Робочий простір: Family');
  });

  it('selecting the already-current workspace does not navigate', async () => {
    currentWorkspace.setWorkspaces([
      { id: 'a', name: 'Family', role: 'admin', grantedAt: '2026-01-01' },
      { id: 'b', name: 'Business', role: 'member', grantedAt: '2026-01-02' },
    ]);
    currentWorkspace.setCurrentId('a');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/w/a/planner', WorkspaceSwitcherComponent);
    harness.detectChanges();

    harness.routeNativeElement
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    harness.detectChanges();

    const familyItem = Array.from(
      document.body.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Family') as HTMLButtonElement;
    familyItem.click();
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url).toBe('/w/a/planner');
    expect(currentWorkspace.currentId()).toBe('a');
  });
});
