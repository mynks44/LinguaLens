import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PopupTranslationComponent } from './popup-translation.component';

describe('PopupTranslationComponent', () => {
  let component: PopupTranslationComponent;
  let fixture: ComponentFixture<PopupTranslationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PopupTranslationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PopupTranslationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
