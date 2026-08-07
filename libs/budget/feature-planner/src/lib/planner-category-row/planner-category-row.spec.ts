import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Money } from 'shared-util';

import { PlannerCategoryRowComponent } from './planner-category-row';
import type { PlannerRowViewModel } from '../planner-rows.util';
import { resolveProgressStatus } from '../planner-progress.util';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  errors: {
    unknown: 'Щось пішло не так. Спробуйте ще раз.',
  },
  planner: {
    row: {
      editBudget: 'Бюджет: {{amount}}',
      amountLabel: 'Сума',
      save: 'Зберегти',
      cancel: 'Скасувати',
      errorInvalidAmount: 'Некоректна сума',
      progressLabel: 'Прогрес для {{name}}',
      progressValueText: 'Витрачено {{percent}}% бюджету',
      spent: 'Витрачено',
      remaining: 'Залишок',
    },
  },
};

function makeRow(
  percent: number,
  overrides: Partial<PlannerRowViewModel> = {},
): PlannerRowViewModel {
  return {
    categoryId: 'c1',
    categoryName: 'Їжа',
    budgeted: Money.fromMinorUnits(10000, 'UAH'),
    spent: Money.fromMinorUnits(Math.round((percent / 100) * 10000), 'UAH'),
    remaining: Money.fromMinorUnits(
      10000 - Math.round((percent / 100) * 10000),
      'UAH',
    ),
    percent,
    status: resolveProgressStatus(percent),
    ...overrides,
  };
}

describe('PlannerCategoryRowComponent', () => {
  let fixture: ComponentFixture<PlannerCategoryRowComponent>;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        PlannerCategoryRowComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlannerCategoryRowComponent);
  }

  async function detectAndStabilize(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it.each([
    [59, 'bg-progress-success'],
    [60, 'bg-progress-success'],
    [89, 'bg-progress-warning'],
    [90, 'bg-progress-warning'],
    [100, 'bg-progress-danger'],
  ] as const)(
    'renders the %d%% bar with the %s color class',
    async (percent, expectedClass) => {
      await setup();
      fixture.componentRef.setInput('row', makeRow(percent));
      await detectAndStabilize();

      const bar = fixture.debugElement.query(
        By.css('[role="progressbar"] > div'),
      ).nativeElement as HTMLElement;
      expect(bar.classList.contains(expectedClass)).toBe(true);
    },
  );

  it('splits an over-budget bar into a green within-budget segment and a red over-budget segment', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(120));
    await detectAndStabilize();

    const segments = fixture.debugElement.queryAll(
      By.css('[role="progressbar"] > div'),
    );
    expect(segments).toHaveLength(2);

    const [withinBudget, overBudget] = segments.map(
      (segment) => segment.nativeElement as HTMLElement,
    );
    expect(withinBudget.classList.contains('bg-progress-success')).toBe(true);
    expect(overBudget.classList.contains('bg-progress-danger')).toBe(true);
    expect(parseFloat(withinBudget.style.width)).toBeCloseTo(83.333);
    expect(parseFloat(overBudget.style.width)).toBeCloseTo(16.667);
  });

  it('renders a single danger-colored segment (no over-budget split) for a high-but-not-overspent row', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(95));
    await detectAndStabilize();

    const segments = fixture.debugElement.queryAll(
      By.css('[role="progressbar"] > div'),
    );
    expect(segments).toHaveLength(1);
    const bar = segments[0].nativeElement as HTMLElement;
    expect(bar.classList.contains('bg-progress-danger')).toBe(true);
    expect(parseFloat(bar.style.width)).toBeCloseTo(95);
  });

  it('renders a single segment (no over-budget split) at exactly 100%', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(100));
    await detectAndStabilize();

    expect(
      fixture.debugElement.queryAll(By.css('[role="progressbar"] > div')),
    ).toHaveLength(1);
  });

  it('shows the edit-budget affordance, not the form, when not editing', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    await detectAndStabilize();

    expect(fixture.debugElement.query(By.css('form'))).toBeNull();
    expect(
      fixture.debugElement.query(By.css('button')).nativeElement.textContent,
    ).toContain('Бюджет');
  });

  it('emits startEdit with the categoryId when the edit affordance is tapped', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    await detectAndStabilize();

    const emitted = vi.fn();
    fixture.componentInstance.startEdit.subscribe(emitted);
    fixture.debugElement.query(By.css('button')).nativeElement.click();

    expect(emitted).toHaveBeenCalledWith('c1');
  });

  it('clamps aria-valuenow to aria-valuemax for an overspent row, conveying the true percent via aria-valuetext', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(300));
    await detectAndStabilize();

    const bar = fixture.debugElement.query(By.css('[role="progressbar"]'))
      .nativeElement as HTMLElement;

    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuetext')).toContain('300');
  });

  it('leaves aria-valuenow unclamped and equal to the true percent for a non-overspent row', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(60));
    await detectAndStabilize();

    const bar = fixture.debugElement.query(By.css('[role="progressbar"]'))
      .nativeElement as HTMLElement;

    expect(bar.getAttribute('aria-valuenow')).toBe('60');
    expect(bar.getAttribute('aria-valuetext')).toContain('60');
  });

  it('renders the amount form pre-filled with the budgeted amount when editing', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    fixture.componentRef.setInput('isEditing', true);
    await detectAndStabilize();

    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    expect(input.value).toBe('100.00');
  });

  it('emits save with the parsed minor-units amount on submit', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    fixture.componentRef.setInput('isEditing', true);
    await detectAndStabilize();

    const emitted = vi.fn();
    fixture.componentInstance.save.subscribe(emitted);

    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    input.value = '250,50';
    input.dispatchEvent(new Event('input'));
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit');

    expect(emitted).toHaveBeenCalledWith({
      categoryId: 'c1',
      amountMinorUnits: 25050,
    });
  });

  it('shows a validation error and does not emit save for an invalid amount', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    fixture.componentRef.setInput('isEditing', true);
    await detectAndStabilize();

    const emitted = vi.fn();
    fixture.componentInstance.save.subscribe(emitted);

    const input = fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit');
    await detectAndStabilize();

    expect(emitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Некоректна сума');
  });

  it('emits cancelEdit when the cancel button is tapped', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    fixture.componentRef.setInput('isEditing', true);
    await detectAndStabilize();

    const emitted = vi.fn();
    fixture.componentInstance.cancelEdit.subscribe(emitted);
    fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) => button.nativeElement.type === 'button')
      ?.nativeElement.click();

    expect(emitted).toHaveBeenCalled();
  });

  it('surfaces a server error next to the save affordance, translated via errorMessageKey', async () => {
    await setup();
    fixture.componentRef.setInput('row', makeRow(0));
    fixture.componentRef.setInput('isEditing', true);
    fixture.componentRef.setInput('errorMessageKey', 'budget.errors.unknown');
    await detectAndStabilize();

    expect(fixture.nativeElement.textContent).toContain(
      'Щось пішло не так. Спробуйте ще раз.',
    );
  });
});
