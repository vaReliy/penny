import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { IdentityService } from 'identity-data-access';

type GreetingState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly message: string }
  | { readonly kind: 'error' };

@Component({
  selector: 'lib-greeting-page',
  imports: [],
  templateUrl: './greeting-page.html',
  styleUrl: './greeting-page.scss',
})
export class GreetingPageComponent {
  private readonly identityService = inject(IdentityService);

  readonly greeting = toSignal(
    this.identityService.getHello().pipe(
      map((r): GreetingState => ({ kind: 'success', message: r.greeting })),
      startWith<GreetingState>({ kind: 'loading' }),
      catchError(() => of<GreetingState>({ kind: 'error' })),
    ),
    { requireSync: true },
  );
}
