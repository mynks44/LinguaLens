import { TestBed } from '@angular/core/testing';

import { MeaningService } from './meaning.service';

describe('MeaningService', () => {
  let service: MeaningService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MeaningService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
