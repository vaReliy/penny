import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { IdentityService } from 'identity-data-access';

@Component({
  selector: 'lib-access-status-page',
  imports: [],
  templateUrl: './access-status-page.html',
  styleUrl: './access-status-page.scss',
})
export class AccessStatusPageComponent {
  private readonly identityService = inject(IdentityService);

  readonly userStatus = toSignal(
    this.identityService.getMe().pipe(
      map((user) =>
        user?.status === 'pending' || user?.status === 'rejected'
          ? user.status
          : null,
      ),
      startWith(null),
      catchError(() => of(null)),
    ),
    { requireSync: true },
  );
}
