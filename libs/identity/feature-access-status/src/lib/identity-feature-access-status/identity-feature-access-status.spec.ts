import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentityFeatureAccessStatus } from './identity-feature-access-status';

describe('IdentityFeatureAccessStatus', () => {
  let component: IdentityFeatureAccessStatus;
  let fixture: ComponentFixture<IdentityFeatureAccessStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentityFeatureAccessStatus],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentityFeatureAccessStatus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
