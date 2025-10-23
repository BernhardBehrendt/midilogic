import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { DataSyncService } from './data-sync';
import { OfflineStorageService } from '../storage/offline-storage';
import { MockOfflineStorageService } from '../../../test-mocks/offline-storage.mock';

describe('DataSyncService', () => {
  let service: DataSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    });
    service = TestBed.inject(DataSyncService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
