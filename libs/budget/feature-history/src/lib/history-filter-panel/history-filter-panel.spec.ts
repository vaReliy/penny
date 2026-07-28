import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HistoryFilterPanelComponent } from './history-filter-panel';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  history: {
    filter: {
      title: 'Фільтр',
      typeLabel: 'Тип',
      typeAll: 'Усі',
      typeIncome: 'Дохід',
      typeExpense: 'Витрата',
      categoryLabel: 'Категорія',
      categoryAll: 'Усі категорії',
      periodLabel: 'Період',
      periodAll: 'Весь час',
      periodDay: 'День',
      periodWeek: 'Тиждень',
      periodMonth: 'Місяць',
      monthLabel: 'Оберіть місяць',
      clear: 'Скинути',
    },
  },
};

describe('HistoryFilterPanelComponent', () => {
  let fixture: ComponentFixture<HistoryFilterPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HistoryFilterPanelComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryFilterPanelComponent);
    fixture.componentRef.setInput('value', {});
    fixture.componentRef.setInput('categories', [
      { id: 'c1', name: 'Їжа' },
      { id: 'c2', name: 'Транспорт' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('emits filterChange with the selected type', () => {
    let emitted: unknown;
    fixture.componentInstance.filterChange.subscribe((value) => {
      emitted = value;
    });

    const select = fixture.debugElement.query(
      By.css('select[formControlName="type"]'),
    ).nativeElement as HTMLSelectElement;
    select.value = 'income';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual({ type: 'income' });
  });

  it('shows the month input only when period is "month"', () => {
    expect(
      fixture.debugElement.query(By.css('input[formControlName="month"]')),
    ).toBeNull();

    const periodSelect = fixture.debugElement.query(
      By.css('select[formControlName="period"]'),
    ).nativeElement as HTMLSelectElement;
    periodSelect.value = 'month';
    periodSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('input[formControlName="month"]')),
    ).not.toBeNull();
  });

  it('emits an empty filter when "clear" is clicked', () => {
    let emitted: unknown;
    fixture.componentInstance.filterChange.subscribe((value) => {
      emitted = value;
    });

    const clearButton = fixture.debugElement.query(
      By.css('button[type="button"]'),
    ).nativeElement as HTMLButtonElement;
    clearButton.click();

    expect(emitted).toEqual({});
  });

  it('reflects an externally-changed value input without re-emitting', async () => {
    let emitCount = 0;
    fixture.componentInstance.filterChange.subscribe(() => {
      emitCount += 1;
    });

    fixture.componentRef.setInput('value', { type: 'expense' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = fixture.debugElement.query(
      By.css('select[formControlName="type"]'),
    ).nativeElement as HTMLSelectElement;
    expect(select.value).toBe('expense');
    expect(emitCount).toBe(0);
  });
});
