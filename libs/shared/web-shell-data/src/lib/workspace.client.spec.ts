import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WorkspaceSummaryDto } from 'shared-contracts';
import { WorkspaceClient } from './workspace.client';

describe('WorkspaceClient', () => {
  let client: WorkspaceClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WorkspaceClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(WorkspaceClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  it('sends GET to /api/workspaces with withCredentials', () => {
    let result: readonly WorkspaceSummaryDto[] | undefined;
    client.list().subscribe((workspaces) => (result = workspaces));

    const req = httpController.expectOne('/api/workspaces');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);

    const response: readonly WorkspaceSummaryDto[] = [
      {
        id: 'a',
        name: 'Family',
        role: 'admin',
        grantedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    req.flush(response);

    expect(result).toEqual(response);
  });
});
