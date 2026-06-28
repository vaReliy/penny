import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentityFeatureGreeting } from './identity-feature-greeting';

describe('IdentityFeatureGreeting', () => {
  let component: IdentityFeatureGreeting;
  let fixture: ComponentFixture<IdentityFeatureGreeting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentityFeatureGreeting],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentityFeatureGreeting);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
