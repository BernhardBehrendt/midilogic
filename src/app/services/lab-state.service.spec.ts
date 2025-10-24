import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { LabStateService, LabState, LabNoteConfig, LabControlConfig } from './lab-state.service';
import { OfflineStorageService } from '../core/storage/offline-storage';

describe('LabStateService', () => {
  let service: LabStateService;
  let mockOfflineStorage: any;

  beforeEach(async () => {
    const spy = {
      getLabState: vi.fn(() => Promise.resolve(null)),
      updateLabState: vi.fn(() => Promise.resolve()),
      saveLabState: vi.fn(() => Promise.resolve('test-id')),
      isInitialized: vi.fn(() => true),
    };

    await TestBed.configureTestingModule({
      providers: [
        LabStateService,
        { provide: OfflineStorageService, useValue: spy },
        provideZonelessChangeDetection(),
      ],
    }).compileComponents();

    service = TestBed.inject(LabStateService);
    mockOfflineStorage = TestBed.inject(OfflineStorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', async () => {
    // Wait for service initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    const state = service.labState();
    expect(state).toBeTruthy();
    expect(state?.name).toBe('Default Lab Session');
    expect(state?.noteConfigs.length).toBe(1);
    expect(state?.controlConfigs.length).toBe(1);
    expect(state?.noteConfigs[0].note).toBe(36); // C2 kick drum
    expect(state?.noteConfigs[0].enabled).toBe(false);
    expect(state?.controlConfigs[0].controller).toBe(1); // Modulation wheel
    expect(state?.controlConfigs[0].enabled).toBe(false);
  });

  describe('Note Configuration Management', () => {
    it('should add note config with default values', () => {
      const id = service.addNoteConfig();
      const noteConfigs = service.noteConfigs();

      expect(noteConfigs.length).toBe(2); // 1 default + 1 added
      expect(noteConfigs[1].id).toBe(id); // The newly added one is at index 1
      expect(noteConfigs[1].enabled).toBe(false);
      expect(noteConfigs[1].note).toBe(36);
      expect(noteConfigs[1].velocity).toBe(100);
    });

    it('should add note config with custom values', () => {
      const customConfig: Partial<LabNoteConfig> = {
        enabled: true,
        note: 60,
        velocity: 127,
        channel: 2,
      };

      const id = service.addNoteConfig(customConfig);
      const noteConfig = service.getNoteConfig(id);

      expect(noteConfig).toBeTruthy();
      expect(noteConfig?.enabled).toBe(true);
      expect(noteConfig?.note).toBe(60);
      expect(noteConfig?.velocity).toBe(127);
      expect(noteConfig?.channel).toBe(2);
    });

    it('should update note config', () => {
      const id = service.addNoteConfig();

      service.updateNoteConfig(id, {
        enabled: true,
        note: 72,
        velocity: 90,
      });

      const noteConfig = service.getNoteConfig(id);
      expect(noteConfig?.enabled).toBe(true);
      expect(noteConfig?.note).toBe(72);
      expect(noteConfig?.velocity).toBe(90);
    });

    it('should remove note config', () => {
      const id = service.addNoteConfig();
      expect(service.noteConfigs().length).toBe(2); // 1 default + 1 added

      service.removeNoteConfig(id);
      expect(service.noteConfigs().length).toBe(1); // Back to just default
      expect(service.getNoteConfig(id)).toBeUndefined();
    });

    it('should count enabled notes correctly', () => {
      const id1 = service.addNoteConfig({ enabled: true });
      const id2 = service.addNoteConfig({ enabled: false });
      const id3 = service.addNoteConfig({ enabled: true });

      expect(service.enabledNoteCount()).toBe(2);

      service.updateNoteConfig(id2, { enabled: true });
      expect(service.enabledNoteCount()).toBe(3);
    });
  });

  describe('Control Configuration Management', () => {
    it('should add control config with default values', () => {
      const id = service.addControlConfig();
      const controlConfigs = service.controlConfigs();

      expect(controlConfigs.length).toBe(2); // 1 default + 1 added
      expect(controlConfigs[1].id).toBe(id); // The newly added one is at index 1
      expect(controlConfigs[1].enabled).toBe(false);
      expect(controlConfigs[1].controller).toBe(1);
      expect(controlConfigs[1].value).toBe(64);
    });

    it('should add control config with custom values', () => {
      const customConfig: Partial<LabControlConfig> = {
        enabled: true,
        controller: 7,
        value: 127,
        channel: 3,
      };

      const id = service.addControlConfig(customConfig);
      const controlConfig = service.getControlConfig(id);

      expect(controlConfig).toBeTruthy();
      expect(controlConfig?.enabled).toBe(true);
      expect(controlConfig?.controller).toBe(7);
      expect(controlConfig?.value).toBe(127);
      expect(controlConfig?.channel).toBe(3);
    });

    it('should update control config', () => {
      const id = service.addControlConfig();

      service.updateControlConfig(id, {
        enabled: true,
        controller: 10,
        value: 100,
      });

      const controlConfig = service.getControlConfig(id);
      expect(controlConfig?.enabled).toBe(true);
      expect(controlConfig?.controller).toBe(10);
      expect(controlConfig?.value).toBe(100);
    });

    it('should remove control config', () => {
      const id = service.addControlConfig();
      expect(service.controlConfigs().length).toBe(2); // 1 default + 1 added

      service.removeControlConfig(id);
      expect(service.controlConfigs().length).toBe(1); // Back to just default
      expect(service.getControlConfig(id)).toBeUndefined();
    });

    it('should count enabled controls correctly', () => {
      const id1 = service.addControlConfig({ enabled: true });
      const id2 = service.addControlConfig({ enabled: false });
      const id3 = service.addControlConfig({ enabled: true });

      expect(service.enabledControlCount()).toBe(2);

      service.updateControlConfig(id2, { enabled: true });
      expect(service.enabledControlCount()).toBe(3);
    });
  });

  describe('State Persistence', () => {
    beforeEach(() => {
      mockOfflineStorage.isInitialized = vi.fn(() => true);
      mockOfflineStorage.updateLabState = vi.fn(() => Promise.resolve());
      mockOfflineStorage.getLabState = vi.fn(() => Promise.resolve(null));
    });

    it('should save state to offline storage', async () => {
      service.addNoteConfig({ enabled: true, note: 60 });
      service.addControlConfig({ enabled: true, controller: 7 });

      await service.saveState();

      // Test passes if no error is thrown
      expect(service.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('Global Settings', () => {
    it('should update global settings', () => {
      service.updateGlobalSettings({
        autoSave: false,
        quickPatternMode: true,
      });

      const state = service.labState();
      expect(state?.globalSettings.autoSave).toBe(false);
      expect(state?.globalSettings.quickPatternMode).toBe(true);
    });
  });

  describe('State Import/Export', () => {
    it('should export state as JSON string', async () => {
      service.addNoteConfig({ enabled: true, note: 60 });

      const exportedJson = await service.exportState();
      const parsedState = JSON.parse(exportedJson);

      expect(parsedState.noteConfigs.length).toBe(2); // 1 default + 1 added
      expect(parsedState.noteConfigs[1].note).toBe(60); // The added one
    });

    it('should import valid state from JSON string', async () => {
      const importState: LabState = {
        id: 'import-test',
        name: 'Imported State',
        noteConfigs: [
          {
            id: 'imported-note',
            enabled: true,
            note: 72,
            velocity: 110,
            channel: 2,
            octave: 5,
            displayMode: 'all',
            useFlats: true,
          },
        ],
        controlConfigs: [],
        globalSettings: {
          autoSave: false,
          quickPatternMode: true,
        },
        created: Date.now(),
        modified: Date.now(),
      };

      const jsonString = JSON.stringify(importState);
      await service.importState(jsonString);

      const currentState = service.labState();
      expect(currentState?.name).toBe('Imported State');
      expect(currentState?.noteConfigs.length).toBe(1);
      expect(currentState?.noteConfigs[0].note).toBe(72);
      expect(currentState?.globalSettings.quickPatternMode).toBe(true);
    });

    it('should throw error for invalid import data', async () => {
      const invalidJson = '{"invalid": "data"}';

      try {
        await service.importState(invalidJson);
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Failed to import state: Invalid format or data');
      }
    });
  });

  describe('State Management Utilities', () => {
    it('should reset to defaults', async () => {
      service.addNoteConfig();
      service.addControlConfig();
      expect(service.totalConfigs()).toBe(4); // 2 defaults + 2 added

      await service.resetToDefaults();

      expect(service.totalConfigs()).toBe(2); // Back to 2 defaults
      expect(service.labState()?.name).toBe('Default Lab Session');
    });
  });

  describe('Computed Values', () => {
    it('should calculate total configs correctly', () => {
      expect(service.totalConfigs()).toBe(2); // Starts with 2 defaults

      service.addNoteConfig();
      expect(service.totalConfigs()).toBe(3);

      service.addControlConfig();
      expect(service.totalConfigs()).toBe(4);

      service.addNoteConfig();
      expect(service.totalConfigs()).toBe(5);
    });

    it('should track dirty state correctly', async () => {
      // Wait for initial auto-save to complete
      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(service.hasUnsavedChanges()).toBe(false);

      service.addNoteConfig();
      expect(service.hasUnsavedChanges()).toBe(true);
    });
  });
});
