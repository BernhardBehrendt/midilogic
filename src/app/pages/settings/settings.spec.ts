import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SettingsComponent } from './settings';
import { SettingsService } from '../../services/settings';
import { ClockService } from '../../services/clock';
import { OfflineStorageService } from '../../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../../test-mocks/offline-storage.mock';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
        SettingsService,
        ClockService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
