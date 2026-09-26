import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkspaceSummaryDto } from 'shared-contracts';
import { workspaceRedirectGuard } from './workspace-redirect.guard';
import { WorkspaceClient } from './workspace.client';
import { CurrentWorkspace } from './current-workspace.store';

const WORKSPACE_A: WorkspaceSummaryDto = {
  id: 'a',
  name: 'Workspace A',
  role: 'admin',
  grantedAt: '2026-01-01T00:00:00.000Z',
};

const WORKSPACE_B: WorkspaceSummaryDto = {
  id: 'b',
  name: 'Workspace B',
  role: 'member',
  grantedAt: '2026-02-01T00:00:00.000Z',
};

describe('workspaceRedirectGuard', () => {
  let router: Router;
  let mockWorkspaceClient: { list: ReturnType<typeof vi.fn> };

  function runGuard(): Observable<UrlTree> {
    return TestBed.runInInjectionContext(() =>
      workspaceRedirectGuard({} as never, {} as never),
    ) as Observable<UrlTree>;
  }

  beforeEach(() => {
    localStorage.clear();
    mockWorkspaceClient = { list: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WorkspaceClient, useValue: mockWorkspaceClient },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('AC-1: redirects to the last-used workspace when it is still in the list', async () => {
    localStorage.setItem('penny.lastWorkspaceId', 'b');
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    const result = await firstValueFrom(runGuard());

    expect(router.serializeUrl(result)).toBe('/w/b/account');
  });

  it('AC-2: redirects to the first workspace when there is no last-used id', async () => {
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    const result = await firstValueFrom(runGuard());

    expect(router.serializeUrl(result)).toBe('/w/a/account');
  });

  it('AC-2: redirects to the first workspace when the last-used id is no longer granted', async () => {
    localStorage.setItem('penny.lastWorkspaceId', 'stale');
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    const result = await firstValueFrom(runGuard());

    expect(router.serializeUrl(result)).toBe('/w/a/account');
  });

  it('AC-2: redirects to the first workspace when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    const result = await firstValueFrom(runGuard());

    expect(router.serializeUrl(result)).toBe('/w/a/account');

    vi.restoreAllMocks();
  });

  it('AC-3: redirects to /no-workspace when the list is empty', async () => {
    mockWorkspaceClient.list.mockReturnValue(of([]));

    const result = await firstValueFrom(runGuard());

    expect(router.serializeUrl(result)).toBe('/no-workspace');
  });

  it('populates CurrentWorkspace with the fetched workspaces and current id', async () => {
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    await firstValueFrom(runGuard());

    const currentWorkspace = TestBed.inject(CurrentWorkspace);
    expect(currentWorkspace.workspaces()).toEqual([WORKSPACE_A, WORKSPACE_B]);
    expect(currentWorkspace.currentId()).toBe('a');
  });
});
