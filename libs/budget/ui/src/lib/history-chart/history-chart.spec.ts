import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { HistoryChartComponent } from './history-chart';

const UK_TRANSLATIONS = {};
const BUDGET_UK_TRANSLATIONS = {
  history: {
    chart: {
      title: 'Витрати за категоріями',
      empty: 'Немає даних для відображення.',
      legendLabel: 'Категорії',
    },
  },
};

describe('HistoryChartComponent', () => {
  let fixture: ComponentFixture<HistoryChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HistoryChartComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
    }).compileComponents();
  });

  async function detectAndStabilize(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the pie chart with a legend item per category when data is present', async () => {
    fixture = TestBed.createComponent(HistoryChartComponent);
    fixture.componentRef.setInput('data', [
      { name: 'Food', value: 15000 },
      { name: 'Transport', value: 5000 },
    ]);
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ngx-charts-pie-chart')).not.toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();

    const legendItems = el.querySelectorAll('ul li');
    expect(legendItems).toHaveLength(2);
    expect(el.textContent).toContain('Food');
    expect(el.textContent).toContain('Transport');
  });

  it('shows the empty-state message when data is empty', async () => {
    fixture = TestBed.createComponent(HistoryChartComponent);
    fixture.componentRef.setInput('data', []);
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Немає даних для відображення.');
    expect(el.querySelector('ngx-charts-pie-chart')).toBeNull();
  });

  it('does not render the untranslated "Legend" heading', async () => {
    fixture = TestBed.createComponent(HistoryChartComponent);
    fixture.componentRef.setInput('data', [
      { name: 'Food', value: 15000 },
      { name: 'Transport', value: 5000 },
    ]);
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Legend');
  });

  it('assigns a distinguishable color per category, cycling the palette', () => {
    fixture = TestBed.createComponent(HistoryChartComponent);
    fixture.componentRef.setInput('data', [
      { name: 'Food', value: 15000 },
      { name: 'Transport', value: 5000 },
      { name: 'Subscriptions', value: 3000 },
      { name: 'Auto', value: 2000 },
    ]);
    const component = fixture.componentInstance as unknown as {
      customColors: () => ReadonlyArray<{ name: string; value: string }>;
    };

    const colors = component.customColors();
    const uniqueValues = new Set(colors.map((entry) => entry.value));

    expect(colors).toHaveLength(4);
    expect(uniqueValues.size).toBe(4);
  });

  it('renders the legend swatches with the same distinct colors as customColors', async () => {
    fixture = TestBed.createComponent(HistoryChartComponent);
    fixture.componentRef.setInput('data', [
      { name: 'Food', value: 15000 },
      { name: 'Transport', value: 5000 },
      { name: 'Subscriptions', value: 3000 },
      { name: 'Auto', value: 2000 },
    ]);
    await detectAndStabilize();

    const el = fixture.nativeElement as HTMLElement;
    const swatches = Array.from(el.querySelectorAll('ul li span'));
    const colors = swatches.map(
      (swatch) => (swatch as HTMLElement).style.backgroundColor,
    );

    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
  });

  it('formats the tooltip text with the category name and uk-UA number formatting', () => {
    fixture = TestBed.createComponent(HistoryChartComponent);
    const component = fixture.componentInstance as unknown as {
      tooltipText: (entry: { data: { name: string; value: number } }) => string;
    };

    const text = component.tooltipText({
      data: { name: 'Food', value: 1234.5 },
    });

    expect(text).toContain('Food');
    expect(text).toMatch(/1\D234,50/);
  });
});
