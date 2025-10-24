import { Injectable, signal, computed, inject } from '@angular/core';
import { OfflineStorageService } from '../core/storage/offline-storage';

export interface LabNoteConfig {
  id: string;
  enabled: boolean;
  note: number;
  velocity: number;
  channel: number;
  octave: number;
  displayMode: 'common' | 'all' | 'drums' | 'octave';
  useFlats: boolean;
}

export interface LabControlConfig {
  id: string;
  enabled: boolean;
  controller: number;
  value: number;
  channel: number;
}

export interface LabState {
  id: string;
  name: string;
  noteConfigs: LabNoteConfig[];
  controlConfigs: LabControlConfig[];
  globalSettings: {
    autoSave: boolean;
    quickPatternMode: boolean;
  };
  created: number;
  modified: number;
}

@Injectable({
  providedIn: 'root',
})
export class LabStateService {
  private offlineStorage = inject(OfflineStorageService);

  // Internal state
  private readonly _labState = signal<LabState>(this.createDefaultState());
  private readonly _isLoading = signal(false);
  private readonly _isDirty = signal(false);
  private readonly _lastSaved = signal<number | null>(null);

  // Auto-save
  private autoSaveTimer: number | null = null;
  private readonly AUTO_SAVE_DELAY = 2000; // 2 seconds

  // Public readonly signals
  readonly labState = this._labState.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly hasUnsavedChanges = this._isDirty.asReadonly();
  readonly lastSavedTime = this._lastSaved.asReadonly();

  // Computed values
  readonly noteConfigs = computed(() => this._labState().noteConfigs);
  readonly controlConfigs = computed(() => this._labState().controlConfigs);
  readonly totalConfigs = computed(() => this.noteConfigs().length + this.controlConfigs().length);
  readonly enabledNoteCount = computed(() => this.noteConfigs().filter((n) => n.enabled).length);
  readonly enabledControlCount = computed(
    () => this.controlConfigs().filter((c) => c.enabled).length,
  );

  constructor() {
    this.loadInitialState();
  }

  private createDefaultState(): LabState {
    const now = Date.now();
    const noteId = `${now}_note_${Math.random().toString(36).substr(2, 9)}`;
    const controlId = `${now}_control_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: 'default',
      name: 'Default Lab Session',
      noteConfigs: [
        {
          id: noteId,
          enabled: false,
          note: 36, // C2 - kick drum
          velocity: 100,
          channel: 0,
          octave: 2,
          displayMode: 'common',
          useFlats: false,
        },
      ],
      controlConfigs: [
        {
          id: controlId,
          enabled: false,
          controller: 1, // Modulation wheel
          value: 64,
          channel: 0,
        },
      ],
      globalSettings: {
        autoSave: true,
        quickPatternMode: false,
      },
      created: now,
      modified: now,
    };
  }

  private async loadInitialState(): Promise<void> {
    try {
      this._isLoading.set(true);

      // Wait for storage to be ready
      let attempts = 0;
      while (!this.offlineStorage.isInitialized() && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (this.offlineStorage.isInitialized()) {
        const savedState = await this.offlineStorage.getLabState('default');
        if (savedState && this.isValidLabState(savedState)) {
          // Ensure saved state has at least the basic structure
          const stateWithDefaults = this.ensureMinimalState(savedState);
          this._labState.set(stateWithDefaults);
          this._lastSaved.set(stateWithDefaults.modified);
          this._isDirty.set(false);
        } else {
          // No valid saved state, use defaults and save them
          const defaultState = this.createDefaultState();
          this._labState.set(defaultState);
          this._isDirty.set(true);
          // Auto-save the default state for consistency
          setTimeout(() => this.saveState(), 100);
        }
      }
    } catch (error) {
      console.warn('Failed to load lab state, using defaults:', error);
    } finally {
      this._isLoading.set(false);
    }
  }

  private isValidLabState(obj: any): obj is LabState {
    return (
      obj &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      Array.isArray(obj.noteConfigs) &&
      Array.isArray(obj.controlConfigs) &&
      obj.globalSettings &&
      typeof obj.created === 'number' &&
      typeof obj.modified === 'number'
    );
  }

  private updateState(updater: (state: LabState) => LabState): void {
    const currentState = this._labState();
    const newState = updater({
      ...currentState,
      modified: Date.now(),
    });

    this._labState.set(newState);
    this._isDirty.set(true);
    this.scheduleAutoSave();
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    const autoSave = this._labState().globalSettings.autoSave;
    if (autoSave) {
      this.autoSaveTimer = window.setTimeout(() => {
        this.saveState();
      }, this.AUTO_SAVE_DELAY);
    }
  }

  private ensureMinimalState(state: LabState): LabState {
    // If we have a saved state but no configs, add defaults
    if (state.noteConfigs.length === 0 && state.controlConfigs.length === 0) {
      const defaultState = this.createDefaultState();
      return {
        ...state,
        noteConfigs: defaultState.noteConfigs,
        controlConfigs: defaultState.controlConfigs,
      };
    }
    return state;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API

  async saveState(): Promise<void> {
    const state = this._labState();

    try {
      if (this.offlineStorage.isInitialized()) {
        const existingState = await this.offlineStorage.getLabState(state.id);

        if (existingState) {
          await this.offlineStorage.updateLabState(state.id, state);
        } else {
          await this.offlineStorage.saveLabState({
            name: state.name,
            noteConfigs: state.noteConfigs,
            controlConfigs: state.controlConfigs,
            globalSettings: state.globalSettings,
          });
        }
      }

      this._isDirty.set(false);
      this._lastSaved.set(Date.now());

      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
    } catch (error) {
      console.error('Failed to save lab state:', error);
    }
  }

  // Note configuration management
  addNoteConfig(config?: Partial<LabNoteConfig>): string {
    const id = this.generateId();
    const newConfig: LabNoteConfig = {
      id,
      enabled: false,
      note: 36,
      velocity: 100,
      channel: 0,
      octave: 4,
      displayMode: 'common',
      useFlats: false,
      ...config,
    };

    this.updateState((state) => ({
      ...state,
      noteConfigs: [...state.noteConfigs, newConfig],
    }));

    return id;
  }

  updateNoteConfig(id: string, updates: Partial<LabNoteConfig>): void {
    this.updateState((state) => ({
      ...state,
      noteConfigs: state.noteConfigs.map((config) =>
        config.id === id ? { ...config, ...updates } : config,
      ),
    }));
  }

  removeNoteConfig(id: string): void {
    this.updateState((state) => ({
      ...state,
      noteConfigs: state.noteConfigs.filter((config) => config.id !== id),
    }));
  }

  getNoteConfig(id: string): LabNoteConfig | undefined {
    return this.noteConfigs().find((config) => config.id === id);
  }

  // Control configuration management
  addControlConfig(config?: Partial<LabControlConfig>): string {
    const id = this.generateId();
    const newConfig: LabControlConfig = {
      id,
      enabled: false,
      controller: 1,
      value: 64,
      channel: 0,
      ...config,
    };

    this.updateState((state) => ({
      ...state,
      controlConfigs: [...state.controlConfigs, newConfig],
    }));

    return id;
  }

  updateControlConfig(id: string, updates: Partial<LabControlConfig>): void {
    this.updateState((state) => ({
      ...state,
      controlConfigs: state.controlConfigs.map((config) =>
        config.id === id ? { ...config, ...updates } : config,
      ),
    }));
  }

  removeControlConfig(id: string): void {
    this.updateState((state) => ({
      ...state,
      controlConfigs: state.controlConfigs.filter((config) => config.id !== id),
    }));
  }

  getControlConfig(id: string): LabControlConfig | undefined {
    return this.controlConfigs().find((config) => config.id === id);
  }

  // Global settings
  updateGlobalSettings(updates: Partial<LabState['globalSettings']>): void {
    this.updateState((state) => ({
      ...state,
      globalSettings: {
        ...state.globalSettings,
        ...updates,
      },
    }));
  }

  // State management utilities
  async resetToDefaults(): Promise<void> {
    const defaultState = this.createDefaultState();
    this._labState.set(defaultState);
    this._isDirty.set(true);
    this._lastSaved.set(null); // Clear last saved time to force save
    await this.saveState();
  }

  async exportState(): Promise<string> {
    return JSON.stringify(this._labState(), null, 2);
  }

  async importState(jsonString: string): Promise<void> {
    try {
      const importedState = JSON.parse(jsonString);

      if (!this.isValidLabState(importedState)) {
        throw new Error('Invalid lab state format');
      }

      // Generate new IDs to avoid conflicts
      const newState: LabState = {
        ...importedState,
        id: this.generateId(),
        noteConfigs: importedState.noteConfigs.map((config) => ({
          ...config,
          id: this.generateId(),
        })),
        controlConfigs: importedState.controlConfigs.map((config) => ({
          ...config,
          id: this.generateId(),
        })),
        modified: Date.now(),
      };

      this._labState.set(newState);
      this._isDirty.set(true);
      await this.saveState();
    } catch (error) {
      console.error('Failed to import lab state:', error);
      throw new Error('Failed to import state: Invalid format or data');
    }
  }

  // Cleanup
  destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }
}
