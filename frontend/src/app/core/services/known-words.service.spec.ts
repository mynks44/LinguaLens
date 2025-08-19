import { TestBed } from '@angular/core/testing';

import { KnownWordsService } from './known-words.service';

describe('KnownWordsService', () => {
  let service: KnownWordsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KnownWordsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
