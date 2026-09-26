import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkspaceSummaryDto } from 'shared-contracts';
import { workspaceGuard } from './workspace.guard';
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

describe('workspaceGuard', () => {
  let router: Router;
  let mockWorkspaceClient: { list: ReturnType<typeof vi.fn> };

  function mockRoute(workspaceId: string): ActivatedRouteSnapshot {
    return {
      paramMap: {
        get: (key: string) => (key === 'workspaceId' ? workspaceId : null),
      },
    } as unknown as ActivatedRouteSnapshot;
  }

  function runGuard(workspaceId: string): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      workspaceGuard(mockRoute(workspaceId), {} as never),
    ) as Observable<boolean | UrlTree>;
  }

  beforeEach(() => {
    mockWorkspaceClient = { list: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WorkspaceClient, useValue: mockWorkspaceClient },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('allows and sets current when the id is in the list', async () => {
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    const result = await firstValueFrom(runGuard('b'));

    expect(result).toBe(true);
    const currentWorkspace = TestBed.inject(CurrentWorkspace);
    expect(currentWorkspace.currentId()).toBe('b');
  });

  it('silently redirects to the first workspace when the id is not in the list', async () => {
    mockWorkspaceClient.list.mockReturnValue(of([WORKSPACE_A, WORKSPACE_B]));

    const result = await firstValueFrom(runGuard('unknown'));

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/w/a/account');
  });

  it('redirects to /no-workspace when the id is unknown and the list is empty', async () => {
    mockWorkspaceClient.list.mockReturnValue(of([]));

    const result = await firstValueFrom(runGuard('unknown'));

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/no-workspace');
  });
});
