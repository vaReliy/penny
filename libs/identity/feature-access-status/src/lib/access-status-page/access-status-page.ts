import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { IdentityService } from 'identity-data-access';

@Component({
  selector: 'lib-access-status-page',
  imports: [],
  templateUrl: './access-status-page.html',
  styleUrl: './access-status-page.scss',
})
export class AccessStatusPageComponent implements OnInit {
  private readonly identityService = inject(IdentityService);
  private readonly destroyRef = inject(DestroyRef);

  protected status: 'pending' | 'rejected' | null = null;

  public ngOnInit(): void {
    this.identityService
      .getMe()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of(null)),
      )
      .subscribe((user) => {
        this.status =
          user?.status === 'pending' || user?.status === 'rejected'
            ? user.status
            : null;
      });
  }
}
