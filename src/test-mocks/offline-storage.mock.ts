import { Injectable, signal } from '@angular/core';
import { MidiPattern, MidiSettings } from '../app/core/storage/offline-storage';

@Injectable()
export class MockOfflineStorageService {
  private mockPatterns: Map<string, MidiPattern> = new Map();
  private mockSettings: MidiSettings | null = null;
  private mockSyncQueue: any[] = [];

  // Reactive signals for storage state
  isOnline = signal(true);
  isInitialized = signal(true);
  pendingSyncCount = signal(0);

  // MIDI Patterns Storage
  async savePattern(
    pattern: Omit<MidiPattern, 'id' | 'created' | 'modified' | 'synced'>,
  ): Promise<string> {
    const id = this.generateId();
    const now = Date.now();
    const fullPattern: MidiPattern = {
      ...pattern,
      id,
      created: now,
      modified: now,
      synced: false,
    };

    this.mockPatterns.set(id, fullPattern);
    this.updatePendingSyncCount();
    return id;
  }

  async updatePattern(id: string, updates: Partial<MidiPattern>): Promise<void> {
    const pattern = this.mockPatterns.get(id);
    if (!pattern) throw new Error('Pattern not found');

    const updatedPattern: MidiPattern = {
      ...pattern,
      ...updates,
      id,
      modified: Date.now(),
      synced: false,
    };

    this.mockPatterns.set(id, updatedPattern);
    this.updatePendingSyncCount();
  }

  async getPattern(id: string): Promise<MidiPattern | null> {
    return this.mockPatterns.get(id) || null;
  }

  async getAllPatterns(): Promise<MidiPattern[]> {
    return Array.from(this.mockPatterns.values());
  }

  async deletePattern(id: string): Promise<void> {
    this.mockPatterns.delete(id);
    this.updatePendingSyncCount();
  }

  // Settings Storage
  async saveSettings(
    settings: Omit<MidiSettings, 'id' | 'created' | 'modified' | 'synced'>,
  ): Promise<void> {
    const id = 'user_settings';
    const now = Date.now();

    const fullSettings: MidiSettings = {
      ...settings,
      id,
      created: this.mockSettings?.created || now,
      modified: now,
      synced: false,
    };

    this.mockSettings = fullSettings;
    this.updatePendingSyncCount();
  }

  async getSettings(): Promise<MidiSettings | null> {
    return this.mockSettings;
  }

  // Sync Management
  async processSyncQueue(): Promise<void> {
    // Mock implementation - just clear the queue
    this.mockSyncQueue = [];
    this.updatePendingSyncCount();
  }

  async clearAllData(): Promise<void> {
    this.mockPatterns.clear();
    this.mockSettings = null;
    this.mockSyncQueue = [];
    this.updatePendingSyncCount();
  }

  // Utility Methods
  private generateId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updatePendingSyncCount(): void {
    // Mock sync count based on unsynced items
    const unsyncedPatterns = Array.from(this.mockPatterns.values()).filter(p => !p.synced).length;
    const unsyncedSettings = this.mockSettings && !this.mockSettings.synced ? 1 : 0;
    this.pendingSyncCount.set(unsyncedPatterns + unsyncedSettings);
  }

  async exportData(): Promise<{ patterns: MidiPattern[]; settings: MidiSettings | null }> {
    const patterns = await this.getAllPatterns();
    const settings = await this.getSettings();
    return { patterns, settings };
  }

  async importData(data: { patterns?: MidiPattern[]; settings?: MidiSettings }): Promise<void> {
    if (data.patterns) {
      for (const pattern of data.patterns) {
        this.mockPatterns.set(pattern.id, { ...pattern, synced: false });
      }
    }

    if (data.settings) {
      this.mockSettings = { ...data.settings, synced: false };
    }

    this.updatePendingSyncCount();
  }

  // Test helpers
  setOnlineStatus(online: boolean): void {
    this.isOnline.set(online);
  }

  reset(): void {
    this.mockPatterns.clear();
    this.mockSettings = null;
    this.mockSyncQueue = [];
    this.isOnline.set(true);
    this.isInitialized.set(true);
    this.pendingSyncCount.set(0);
  }
}
