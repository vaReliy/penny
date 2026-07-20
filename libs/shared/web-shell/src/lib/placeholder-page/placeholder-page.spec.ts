import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, it, expect } from 'vitest';
import { PlaceholderPageComponent } from './placeholder-page';

describe('PlaceholderPageComponent', () => {
  it('renders the coming-soon translation', async () => {
    await TestBed.configureTestingModule({
      imports: [
        PlaceholderPageComponent,
        TranslocoTestingModule.forRoot({
          langs: {
            uk: { shell: { placeholder: { comingSoon: 'Скоро тут' } } },
          },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlaceholderPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Скоро тут');
  });
});
