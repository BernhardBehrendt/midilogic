import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { OfflineSettingsComponent } from './offline-settings';
import { OfflineStorageService } from '../../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../../test-mocks/offline-storage.mock';

describe('OfflineSettingsComponent', () => {
  let component: OfflineSettingsComponent;
  let fixture: ComponentFixture<OfflineSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineSettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
