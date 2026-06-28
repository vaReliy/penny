import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessStatusPage } from './access-status-page';

describe('AccessStatusPage', () => {
  let component: AccessStatusPage;
  let fixture: ComponentFixture<AccessStatusPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessStatusPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessStatusPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
