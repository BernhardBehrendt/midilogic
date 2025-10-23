import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { OfflineIndicatorComponent } from './offline-indicator';
import { OfflineStorageService } from '../../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../../test-mocks/offline-storage.mock';

describe('OfflineIndicatorComponent', () => {
  let component: OfflineIndicatorComponent;
  let fixture: ComponentFixture<OfflineIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineIndicatorComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
