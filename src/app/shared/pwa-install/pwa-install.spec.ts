import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PwaInstallComponent } from './pwa-install';
import { OfflineStorageService } from '../../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../../test-mocks/offline-storage.mock';

describe('PwaInstallComponent', () => {
  let component: PwaInstallComponent;
  let fixture: ComponentFixture<PwaInstallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PwaInstallComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PwaInstallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
