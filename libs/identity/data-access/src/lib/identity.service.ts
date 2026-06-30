import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { SessionUser } from 'shared-contracts';
import type { RawTelegramLoginPayload } from 'shared-contracts';

export interface TelegramAuthResponse {
  readonly status: string;
}

const AUTH_BASE = '/api/auth';

@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly http = inject(HttpClient);

  public submitTelegramLogin(
    params: RawTelegramLoginPayload,
  ): Observable<TelegramAuthResponse> {
    return this.http.post<TelegramAuthResponse>(
      `${AUTH_BASE}/telegram`,
      params,
      { withCredentials: true },
    );
  }

  public getMe(): Observable<SessionUser> {
    return this.http.get<SessionUser>(`${AUTH_BASE}/me`, {
      withCredentials: true,
    });
  }

  public logout(): Observable<void> {
    return this.http.post<void>(`${AUTH_BASE}/logout`, null, {
      withCredentials: true,
    });
  }

  public getHello(): Observable<{
    readonly greeting: string;
    readonly telegramId: string;
  }> {
    return this.http.get<{
      readonly greeting: string;
      readonly telegramId: string;
    }>('/api/hello', {
      withCredentials: true,
    });
  }
}
