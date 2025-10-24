import { Injectable, signal } from '@angular/core';

export interface StorageItem {
  id: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

export interface MidiPattern {
  id: string;
  name: string;
  notes: number[];
  timing: number[];
  channel: number;
  velocity: number[];
  created: number;
  modified: number;
  synced: boolean;
}

export interface MidiSettings {
  id: string;
  outputDevice?: string;
  inputDevice?: string;
  defaultChannel: number;
  defaultVelocity: number;
  clockSync: boolean;
  created: number;
  modified: number;
  synced: boolean;
}

export interface LabState {
  id: string;
  name: string;
  noteConfigs: any[];
  controlConfigs: any[];
  globalSettings: {
    autoSave: boolean;
    quickPatternMode: boolean;
  };
  created: number;
  modified: number;
  synced: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'MidiLogicDB';
  private readonly dbVersion = 2;

  // Reactive signals for storage state
  isOnline = signal(navigator.onLine);
  isInitialized = signal(false);
  pendingSyncCount = signal(0);

  constructor() {
    this.initializeDatabase();
    this.setupOnlineStatusListener();
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized.set(true);
        this.updatePendingSyncCount();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('patterns')) {
          const patternsStore = db.createObjectStore('patterns', { keyPath: 'id' });
          patternsStore.createIndex('synced', 'synced', { unique: false });
          patternsStore.createIndex('modified', 'modified', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
          settingsStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('lab_states')) {
          const labStatesStore = db.createObjectStore('lab_states', { keyPath: 'id' });
          labStatesStore.createIndex('synced', 'synced', { unique: false });
          labStatesStore.createIndex('modified', 'modified', { unique: false });
        }
      };
    });
  }

  private setupOnlineStatusListener(): void {
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  // MIDI Patterns Storage
  async savePattern(
    pattern: Omit<MidiPattern, 'id' | 'created' | 'modified' | 'synced'>,
  ): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = Date.now();
    const fullPattern: MidiPattern = {
      ...pattern,
      id,
      created: now,
      modified: now,
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readwrite');
      const store = transaction.objectStore('patterns');
      const request = store.add(fullPattern);

      request.onsuccess = () => {
        this.queueForSync('patterns', id);
        this.updatePendingSyncCount();
        resolve(id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async updatePattern(id: string, updates: Partial<MidiPattern>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const pattern = await this.getPattern(id);
    if (!pattern) throw new Error('Pattern not found');

    const updatedPattern: MidiPattern = {
      ...pattern,
      ...updates,
      id,
      modified: Date.now(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readwrite');
      const store = transaction.objectStore('patterns');
      const request = store.put(updatedPattern);

      request.onsuccess = () => {
        this.queueForSync('patterns', id);
        this.updatePendingSyncCount();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getPattern(id: string): Promise<MidiPattern | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readonly');
      const store = transaction.objectStore('patterns');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPatterns(): Promise<MidiPattern[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readonly');
      const store = transaction.objectStore('patterns');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePattern(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['patterns'], 'readwrite');
      const store = transaction.objectStore('patterns');
      const request = store.delete(id);

      request.onsuccess = () => {
        this.queueForSync('patterns', id, 'delete');
        this.updatePendingSyncCount();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Lab States Storage
  async saveLabState(
    labState: Omit<LabState, 'id' | 'created' | 'modified' | 'synced'>,
  ): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = Date.now();
    const fullLabState: LabState = {
      ...labState,
      id,
      created: now,
      modified: now,
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lab_states'], 'readwrite');
      const store = transaction.objectStore('lab_states');
      const request = store.add(fullLabState);

      request.onsuccess = () => {
        this.queueForSync('lab_states', id);
        this.updatePendingSyncCount();
        resolve(id);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async updateLabState(id: string, updates: Partial<LabState>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const labState = await this.getLabState(id);
    if (!labState) throw new Error('Lab state not found');

    const updatedLabState: LabState = {
      ...labState,
      ...updates,
      id,
      modified: Date.now(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lab_states'], 'readwrite');
      const store = transaction.objectStore('lab_states');
      const request = store.put(updatedLabState);

      request.onsuccess = () => {
        this.queueForSync('lab_states', id);
        this.updatePendingSyncCount();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getLabState(id: string): Promise<LabState | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lab_states'], 'readonly');
      const store = transaction.objectStore('lab_states');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllLabStates(): Promise<LabState[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lab_states'], 'readonly');
      const store = transaction.objectStore('lab_states');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteLabState(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lab_states'], 'readwrite');
      const store = transaction.objectStore('lab_states');
      const request = store.delete(id);

      request.onsuccess = () => {
        this.queueForSync('lab_states', id, 'delete');
        this.updatePendingSyncCount();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Settings Storage
  async saveSettings(
    settings: Omit<MidiSettings, 'id' | 'created' | 'modified' | 'synced'>,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const id = 'user_settings';
    const now = Date.now();
    const existingSettings = await this.getSettings();

    const fullSettings: MidiSettings = {
      ...settings,
      id,
      created: existingSettings?.created || now,
      modified: now,
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put(fullSettings);

      request.onsuccess = () => {
        this.queueForSync('settings', id);
        this.updatePendingSyncCount();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getSettings(): Promise<MidiSettings | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('user_settings');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync Management
  private async queueForSync(
    store: string,
    id: string,
    operation: 'create' | 'update' | 'delete' = 'update',
  ): Promise<void> {
    if (!this.db) return;

    const syncItem = {
      id: `${store}_${id}_${Date.now()}`,
      store,
      itemId: id,
      operation,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_queue'], 'readwrite');
      const syncStore = transaction.objectStore('sync_queue');
      const request = syncStore.add(syncItem);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updatePendingSyncCount(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['sync_queue'], 'readonly');
      const store = transaction.objectStore('sync_queue');
      const request = store.count();

      request.onsuccess = () => {
        this.pendingSyncCount.set(request.result);
        resolve();
      };

      request.onerror = () => resolve();
    });
  }

  async processSyncQueue(): Promise<void> {
    if (!this.db || !this.isOnline()) return;

    // This method would integrate with your backend API
    // For now, we'll just mark items as synced locally
    console.log('Processing sync queue...');

    // In a real implementation, you would:
    // 1. Get all items from sync_queue
    // 2. Send them to your backend API
    // 3. Mark them as synced on success
    // 4. Remove them from sync_queue

    this.updatePendingSyncCount();
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stores = ['patterns', 'settings', 'sync_queue', 'lab_states'];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      let completed = 0;

      stores.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) {
            this.updatePendingSyncCount();
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  // Utility Methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async exportData(): Promise<{
    patterns: MidiPattern[];
    settings: MidiSettings | null;
    labStates: LabState[];
  }> {
    const patterns = await this.getAllPatterns();
    const settings = await this.getSettings();
    const labStates = await this.getAllLabStates();

    return { patterns, settings, labStates };
  }

  async importData(data: {
    patterns?: MidiPattern[];
    settings?: MidiSettings;
    labStates?: LabState[];
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['patterns', 'settings', 'lab_states'], 'readwrite');

    if (data.patterns) {
      const patternsStore = transaction.objectStore('patterns');
      for (const pattern of data.patterns) {
        await new Promise<void>((resolve, reject) => {
          const request = patternsStore.put({ ...pattern, synced: false });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    }

    if (data.settings) {
      const settingsStore = transaction.objectStore('settings');
      await new Promise<void>((resolve, reject) => {
        const request = settingsStore.put({ ...data.settings, synced: false });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    if (data.labStates) {
      const labStatesStore = transaction.objectStore('lab_states');
      for (const labState of data.labStates) {
        await new Promise<void>((resolve, reject) => {
          const request = labStatesStore.put({ ...labState, synced: false });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    }

    this.updatePendingSyncCount();
  }
}
