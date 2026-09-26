import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { WorkspaceSummaryDto } from 'shared-contracts';

const WORKSPACES_BASE = '/api/workspaces';

/** Typed HTTP client for the caller's workspace membership list. */
@Injectable({ providedIn: 'root' })
export class WorkspaceClient {
  private readonly http = inject(HttpClient);

  public list(): Observable<readonly WorkspaceSummaryDto[]> {
    return this.http.get<readonly WorkspaceSummaryDto[]>(WORKSPACES_BASE, {
      withCredentials: true,
    });
  }
}
