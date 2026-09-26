import { inject } from '@angular/core';
import type {
  ActivatedRouteSnapshot,
  CanActivateFn,
  UrlTree,
} from '@angular/router';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { CurrentWorkspace } from './current-workspace.store';
import { WorkspaceClient } from './workspace.client';

/**
 * Guards `w/:workspaceId`. A stale/unknown id silently falls back to the
 * first workspace (or `/no-workspace`) — no error toast.
 */
export const workspaceGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const workspaceClient = inject(WorkspaceClient);
  const currentWorkspace = inject(CurrentWorkspace);

  const requestedId = route.paramMap.get('workspaceId');

  return workspaceClient.list().pipe(
    map((workspaces): boolean | UrlTree => {
      currentWorkspace.setWorkspaces(workspaces);

      const requested = workspaces.find(
        (workspace) => workspace.id === requestedId,
      );
      if (requested !== undefined) {
        currentWorkspace.setCurrentId(requested.id);
        return true;
      }

      if (workspaces.length === 0) {
        return router.createUrlTree(['/no-workspace']);
      }

      const fallback = workspaces[0];
      currentWorkspace.setCurrentId(fallback.id);
      return router.createUrlTree(['/w', fallback.id, 'account']);
    }),
  );
};
