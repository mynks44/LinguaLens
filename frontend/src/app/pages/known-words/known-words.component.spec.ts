import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnownWordsComponent } from './known-words.component';

describe('KnownWordsComponent', () => {
  let component: KnownWordsComponent;
  let fixture: ComponentFixture<KnownWordsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KnownWordsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(KnownWordsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
