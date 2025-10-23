import { Injectable, signal, computed, inject } from '@angular/core';
import { interval, merge, EMPTY, fromEvent } from 'rxjs';
import { switchMap, filter, debounceTime, retry, catchError } from 'rxjs/operators';
import { OfflineStorageService, MidiPattern, MidiSettings } from '../storage/offline-storage';
import { NetworkStatusService } from '../network/network-status';

export interface SyncStatus {
  isEnabled: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  failedAttempts: number;
  pendingChanges: number;
  error: string | null;
}

export interface SyncConfig {
  autoSyncInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  batchSize: number;
  enableBackgroundSync: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'pattern' | 'settings';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

@Injectable({
  providedIn: 'root',
})
export class DataSyncService {
  private offlineStorage = inject(OfflineStorageService);
  private networkStatus = inject(NetworkStatusService);

  // Configuration
  private config: SyncConfig = {
    autoSyncInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    batchSize: 10,
    enableBackgroundSync: true,
  };

  // Sync state signals
  private _syncStatus = signal<SyncStatus>({
    isEnabled: true,
    isSyncing: false,
    lastSyncTime: null,
    failedAttempts: 0,
    pendingChanges: 0,
    error: null,
  });

  private _syncQueue = signal<SyncQueueItem[]>([]);

  // Public readonly signals
  readonly syncStatus = this._syncStatus.asReadonly();
  readonly syncQueue = this._syncQueue.asReadonly();

  // Computed signals
  readonly canSync = computed(() => {
    const status = this._syncStatus();
    const isOnline = this.networkStatus.isOnline();
    return status.isEnabled && isOnline && !status.isSyncing;
  });

  readonly syncProgress = computed(() => {
    const queue = this._syncQueue();
    const status = this._syncStatus();
    if (queue.length === 0) return 100;
    return Math.round(((queue.length - status.pendingChanges) / queue.length) * 100);
  });

  constructor() {
    this.setupAutoSync();
    this.setupNetworkListener();
    this.initializeSyncQueue();
  }

  private setupAutoSync(): void {
    if (!this.config.enableBackgroundSync) return;

    // Auto-sync when online and enabled
    const autoSync$ = interval(this.config.autoSyncInterval).pipe(
      filter(() => this.canSync()),
      switchMap(() => this.performSync()),
      catchError((error) => {
        console.error('Auto-sync error:', error);
        return EMPTY;
      }),
    );

    autoSync$.subscribe();
  }

  private setupNetworkListener(): void {
    // Sync when coming back online
    this.networkStatus.onOnline(() => {
      if (this._syncStatus().isEnabled && this._syncQueue().length > 0) {
        setTimeout(() => this.performSync(), 1000); // Small delay to ensure connection is stable
      }
    });
  }

  private async initializeSyncQueue(): Promise<void> {
    try {
      // Load pending sync items from storage
      const pendingItems = await this.loadPendingSyncItems();
      this._syncQueue.set(pendingItems);
      this.updateSyncStatus({ pendingChanges: pendingItems.length });
    } catch (error) {
      console.error('Failed to initialize sync queue:', error);
    }
  }

  // Queue management
  async queueForSync(
    type: 'pattern' | 'settings',
    operation: 'create' | 'update' | 'delete',
    data: any,
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: this.generateSyncId(),
      type,
      operation,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    const currentQueue = this._syncQueue();
    const updatedQueue = [...currentQueue, item];
    this._syncQueue.set(updatedQueue);

    // Persist queue to storage
    await this.saveSyncQueue(updatedQueue);

    this.updateSyncStatus({ pendingChanges: updatedQueue.length });

    // Trigger immediate sync if online and not currently syncing
    if (this.canSync()) {
      this.performSync();
    }
  }

  private async performSync(): Promise<void> {
    if (!this.canSync()) return;

    this.updateSyncStatus({ isSyncing: true, error: null });

    try {
      const queue = this._syncQueue();
      const batch = queue.slice(0, this.config.batchSize);

      if (batch.length === 0) {
        this.updateSyncStatus({ isSyncing: false });
        return;
      }

      // Process batch
      const results = await Promise.allSettled(batch.map((item) => this.syncItem(item)));

      // Handle results
      const successful: string[] = [];
      const failed: SyncQueueItem[] = [];

      results.forEach((result, index) => {
        const item = batch[index];
        if (result.status === 'fulfilled') {
          successful.push(item.id);
        } else {
          if (item.retries < this.config.maxRetries) {
            failed.push({
              ...item,
              retries: item.retries + 1,
            });
          } else {
            console.error(`Max retries exceeded for sync item ${item.id}:`, result.reason);
          }
        }
      });

      // Update queue - remove successful items, update failed items
      const remainingQueue = this._syncQueue()
        .filter((item) => !successful.includes(item.id))
        .map((item) => {
          const failedItem = failed.find((f) => f.id === item.id);
          return failedItem || item;
        });

      this._syncQueue.set(remainingQueue);
      await this.saveSyncQueue(remainingQueue);

      this.updateSyncStatus({
        isSyncing: false,
        lastSyncTime: Date.now(),
        pendingChanges: remainingQueue.length,
        failedAttempts: failed.length > 0 ? this._syncStatus().failedAttempts + 1 : 0,
      });

      // Continue syncing if there are more items
      if (remainingQueue.length > 0 && this.canSync()) {
        setTimeout(() => this.performSync(), this.config.retryDelay);
      }
    } catch (error) {
      console.error('Sync batch failed:', error);
      this.updateSyncStatus({
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Unknown sync error',
        failedAttempts: this._syncStatus().failedAttempts + 1,
      });
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    // This method would integrate with your backend API
    // For now, we'll simulate the sync operation

    return new Promise((resolve, reject) => {
      // Simulate network delay
      setTimeout(
        () => {
          // Simulate occasional failures for testing
          if (Math.random() < 0.1) {
            reject(new Error(`Sync failed for item ${item.id}`));
            return;
          }

          // In a real implementation, you would:
          // 1. Send the data to your backend API
          // 2. Handle the response
          // 3. Update local storage with sync status

          console.log(`Synced ${item.type} ${item.operation}:`, item.data);
          resolve();
        },
        Math.random() * 1000 + 500,
      ); // 500-1500ms delay
    });
  }

  // Storage helpers
  private async loadPendingSyncItems(): Promise<SyncQueueItem[]> {
    try {
      const stored = localStorage.getItem('midi_sync_queue');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      return [];
    }
  }

  private async saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
    try {
      localStorage.setItem('midi_sync_queue', JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Public API methods
  async forceSyncAll(): Promise<void> {
    if (!this.networkStatus.isOnline()) {
      throw new Error('Cannot sync while offline');
    }

    this.updateSyncStatus({ isEnabled: true });
    await this.performSync();
  }

  pauseSync(): void {
    this.updateSyncStatus({ isEnabled: false });
  }

  resumeSync(): void {
    this.updateSyncStatus({ isEnabled: true });
    if (this.canSync() && this._syncQueue().length > 0) {
      this.performSync();
    }
  }

  async clearSyncQueue(): Promise<void> {
    this._syncQueue.set([]);
    await this.saveSyncQueue([]);
    this.updateSyncStatus({ pendingChanges: 0, error: null });
  }

  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Specific sync methods for MIDI data
  async syncPattern(
    pattern: MidiPattern,
    operation: 'create' | 'update' | 'delete',
  ): Promise<void> {
    await this.queueForSync('pattern', operation, pattern);
  }

  async syncSettings(settings: MidiSettings): Promise<void> {
    await this.queueForSync('settings', 'update', settings);
  }

  // Conflict resolution (for future implementation)
  async resolveConflict(
    localItem: any,
    remoteItem: any,
    resolution: 'local' | 'remote' | 'merge',
  ): Promise<any> {
    switch (resolution) {
      case 'local':
        return localItem;
      case 'remote':
        return remoteItem;
      case 'merge':
        // Simple merge strategy - could be more sophisticated
        return {
          ...remoteItem,
          ...localItem,
          modified: Math.max(localItem.modified || 0, remoteItem.modified || 0),
        };
      default:
        return localItem;
    }
  }

  // Utility methods
  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    this._syncStatus.update((current) => ({ ...current, ...updates }));
  }

  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Export/Import with sync awareness
  async exportSyncableData(): Promise<{
    patterns: MidiPattern[];
    settings: MidiSettings | null;
    syncQueue: SyncQueueItem[];
    lastSync: number | null;
  }> {
    const data = await this.offlineStorage.exportData();
    return {
      ...data,
      syncQueue: this._syncQueue(),
      lastSync: this._syncStatus().lastSyncTime,
    };
  }

  async importSyncableData(data: {
    patterns?: MidiPattern[];
    settings?: MidiSettings;
    syncQueue?: SyncQueueItem[];
  }): Promise<void> {
    // Import data to offline storage
    await this.offlineStorage.importData({
      patterns: data.patterns,
      settings: data.settings,
    });

    // Merge sync queues
    if (data.syncQueue) {
      const currentQueue = this._syncQueue();
      const mergedQueue = [...currentQueue, ...data.syncQueue];
      this._syncQueue.set(mergedQueue);
      await this.saveSyncQueue(mergedQueue);
    }

    this.updateSyncStatus({
      pendingChanges: this._syncQueue().length,
    });
  }

  // Health check
  getSyncHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const status = this._syncStatus();
    const queue = this._syncQueue();
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (status.failedAttempts > 5) {
      issues.push('Multiple sync failures detected');
      recommendations.push('Check network connection and try manual sync');
    }

    if (queue.length > 100) {
      issues.push('Large sync queue detected');
      recommendations.push('Consider clearing old sync items or increasing sync frequency');
    }

    if (status.lastSyncTime && Date.now() - status.lastSyncTime > 3600000) {
      // 1 hour
      issues.push('Last sync was more than 1 hour ago');
      recommendations.push('Enable automatic sync or perform manual sync');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
    };
  }
}
