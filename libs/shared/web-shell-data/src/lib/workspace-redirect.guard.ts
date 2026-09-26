import { inject } from '@angular/core';
import type { CanActivateFn, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { CurrentWorkspace } from './current-workspace.store';
import { WorkspaceClient } from './workspace.client';

/**
 * Resolves `/` to the last-used workspace (if still granted), else the
 * first workspace by grant order, else `/no-workspace`.
 */
export const workspaceRedirectGuard: CanActivateFn =
  (): Observable<UrlTree> => {
    const router = inject(Router);
    const workspaceClient = inject(WorkspaceClient);
    const currentWorkspace = inject(CurrentWorkspace);

    return workspaceClient.list().pipe(
      map((workspaces): UrlTree => {
        currentWorkspace.setWorkspaces(workspaces);

        if (workspaces.length === 0) {
          return router.createUrlTree(['/no-workspace']);
        }

        const lastUsedId = currentWorkspace.getLastUsedId();
        const lastUsedWorkspace =
          lastUsedId !== null
            ? workspaces.find((workspace) => workspace.id === lastUsedId)
            : undefined;
        const target = lastUsedWorkspace ?? workspaces[0];

        currentWorkspace.setCurrentId(target.id);
        return router.createUrlTree(['/w', target.id, 'account']);
      }),
    );
  };
