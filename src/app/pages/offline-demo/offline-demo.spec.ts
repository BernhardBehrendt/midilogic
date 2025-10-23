import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { OfflineDemoComponent } from './offline-demo';
import { OfflineStorageService } from '../../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../../test-mocks/offline-storage.mock';

describe('OfflineDemoComponent', () => {
  let component: OfflineDemoComponent;
  let fixture: ComponentFixture<OfflineDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineDemoComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfflineDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
