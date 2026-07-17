import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { IdentityService, UserStatus } from 'identity-data-access';

@Component({
  selector: 'lib-access-status-page',
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope('identity')],
  templateUrl: './access-status-page.html',
  styleUrl: './access-status-page.scss',
})
export class AccessStatusPageComponent {
  private readonly identityService = inject(IdentityService);

  readonly userStatus = toSignal(
    this.identityService.getMe().pipe(
      map((user) =>
        user?.status === UserStatus.PENDING ||
        user?.status === UserStatus.REJECTED
          ? user.status
          : null,
      ),
      startWith(null),
      catchError(() => of(null)),
    ),
    { requireSync: true },
  );
}
