import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
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
export class GreetingPageComponent implements OnInit {
  private readonly identityService = inject(IdentityService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<GreetingState>({ kind: 'loading' });

  protected readonly greetingMessage = computed<string | null>(() => {
    const s = this.state();
    return s.kind === 'success' ? s.message : null;
  });

  public ngOnInit(): void {
    this.identityService
      .getHello()
      .pipe(
        map((r): GreetingState => ({ kind: 'success', message: r.message })),
        catchError(() => of<GreetingState>({ kind: 'error' })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((s) => this.state.set(s));
  }
}
