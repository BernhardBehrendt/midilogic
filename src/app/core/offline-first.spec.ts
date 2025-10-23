import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { OfflineFirstService } from './offline-first';
import { OfflineStorageService } from './storage/offline-storage';
import { MockOfflineStorageService } from '../../test-mocks/offline-storage.mock';

describe('OfflineFirstService', () => {
  let service: OfflineFirstService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    });
    service = TestBed.inject(OfflineFirstService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
