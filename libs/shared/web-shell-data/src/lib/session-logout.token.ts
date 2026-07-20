import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

export const SESSION_LOGOUT = new InjectionToken<() => Observable<void>>(
  'SESSION_LOGOUT',
);
