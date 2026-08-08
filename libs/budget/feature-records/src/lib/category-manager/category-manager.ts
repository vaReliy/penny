import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { CategoryStore, errorMessageKey } from 'budget-data-access';
import type { CategoryView } from 'budget-data-access';
import { MAX_NAME_LENGTH } from 'shared-util';

/** How long a post-action confirmation message stays visible, in ms. */
const SUCCESS_MESSAGE_DURATION_MS = 5000;

function buildNameForm(initialName = '') {
  return new FormGroup({
    name: new FormControl(initialName, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME_LENGTH)],
    }),
  });
}

/**
 * Category management: list (with archived hidden by default, toggleable),
 * create, rename, and archive-with-confirm. Per ADR-007 §6 the API never
 * blocks archiving a category with transaction history (soft-archive keeps
 * historical aggregation intact) — the confirm step here is a UX safety net,
 * not a gate on a backend-side history check. Each action gets its own error
 * signal rendered next to its own affordance, per the per-action
 * error-surfacing convention this task settles.
 */
@Component({
  selector: 'lib-category-manager',
  imports: [ReactiveFormsModule, TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-manager.html',
  styleUrl: './category-manager.css',
})
export class CategoryManagerComponent {
  protected readonly categoryStore = inject(CategoryStore);

  protected readonly errorMessageKey = errorMessageKey;
  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly showArchived = signal(false);
  protected readonly createForm = buildNameForm();
  protected readonly editingId = signal<string | null>(null);
  protected readonly renameForm = buildNameForm();
  protected readonly pendingArchiveId = signal<string | null>(null);
  protected readonly createSuccess = signal(false);
  protected readonly renameSuccess = signal(false);
  protected readonly archiveSuccess = signal(false);

  private readonly createSubmitted = signal(false);
  private readonly renameSubmitted = signal(false);
  private readonly archiveSubmitted = signal(false);

  protected readonly visibleCategories = computed<readonly CategoryView[]>(
    () => {
      const categories = this.categoryStore.data();
      return this.showArchived()
        ? categories
        : categories.filter((category) => category.archivedAt === undefined);
    },
  );

  public constructor() {
    effect(() => {
      const loading = this.categoryStore.createLoading();
      const error = this.categoryStore.createError();
      if (!loading && this.createSubmitted()) {
        this.createSubmitted.set(false);
        if (error === null) {
          this.createForm.reset({ name: '' });
          this.createSuccess.set(true);
          setTimeout(
            () => this.createSuccess.set(false),
            SUCCESS_MESSAGE_DURATION_MS,
          );
        }
      }
    });

    effect(() => {
      const loading = this.categoryStore.updateLoading();
      const error = this.categoryStore.updateError();
      if (!loading && this.renameSubmitted()) {
        this.renameSubmitted.set(false);
        if (error === null) {
          this.editingId.set(null);
          this.renameSuccess.set(true);
          setTimeout(
            () => this.renameSuccess.set(false),
            SUCCESS_MESSAGE_DURATION_MS,
          );
        }
      }
    });

    effect(() => {
      const loading = this.categoryStore.archiveLoading();
      const error = this.categoryStore.archiveError();
      if (!loading && this.archiveSubmitted()) {
        this.archiveSubmitted.set(false);
        if (error === null) {
          this.pendingArchiveId.set(null);
          this.archiveSuccess.set(true);
          setTimeout(
            () => this.archiveSuccess.set(false),
            SUCCESS_MESSAGE_DURATION_MS,
          );
        }
      }
    });
  }

  protected toggleShowArchived(): void {
    this.showArchived.set(!this.showArchived());
  }

  protected onCreateSubmit(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.createSubmitted.set(true);
    this.categoryStore.create({
      name: this.createForm.getRawValue().name.trim(),
    });
  }

  protected startRename(category: CategoryView): void {
    this.pendingArchiveId.set(null);
    this.editingId.set(category.id);
    this.renameForm.reset({ name: category.name });
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  protected onRenameSubmit(id: string): void {
    if (this.renameForm.invalid) {
      this.renameForm.markAllAsTouched();
      return;
    }
    this.renameSubmitted.set(true);
    this.categoryStore.update(id, {
      name: this.renameForm.getRawValue().name.trim(),
    });
  }

  protected requestArchive(id: string): void {
    this.editingId.set(null);
    this.pendingArchiveId.set(id);
  }

  protected cancelArchive(): void {
    this.pendingArchiveId.set(null);
  }

  protected confirmArchive(id: string): void {
    this.archiveSubmitted.set(true);
    this.categoryStore.archive(id);
  }
}
