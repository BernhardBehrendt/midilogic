import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, switchMap, catchError } from 'rxjs/operators';
import { EMPTY, fromEvent } from 'rxjs';
import { OfflineStorageService } from './storage/offline-storage';
import { NetworkStatusService } from './network/network-status';
import { DataSyncService } from './sync/data-sync';

export interface OfflineFirstConfig {
  enableAutoUpdate: boolean;
  enableBackgroundSync: boolean;
  enablePersistentStorage: boolean;
  syncInterval: number;
  maxStorageQuota: number;
}

export interface OfflineFirstStatus {
  isInitialized: boolean;
  hasUpdate: boolean;
  isInstallable: boolean;
  storageUsage: number;
  storageQuota: number;
  cacheStatus: 'fresh' | 'stale' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class OfflineFirstService {
  private swUpdate = inject(SwUpdate, { optional: true });
  private offlineStorage = inject(OfflineStorageService);
  private networkStatus = inject(NetworkStatusService);
  private dataSync = inject(DataSyncService);

  // Configuration
  private config: OfflineFirstConfig = {
    enableAutoUpdate: true,
    enableBackgroundSync: true,
    enablePersistentStorage: true,
    syncInterval: 30000,
    maxStorageQuota: 50 * 1024 * 1024, // 50MB
  };

  // State signals
  private _status = signal<OfflineFirstStatus>({
    isInitialized: false,
    hasUpdate: false,
    isInstallable: false,
    storageUsage: 0,
    storageQuota: 0,
    cacheStatus: 'fresh',
  });

  private _installPrompt: any = null;

  // Public readonly signals
  readonly status = this._status.asReadonly();
  readonly isOnline = this.networkStatus.isOnline;
  readonly syncStatus = this.dataSync.syncStatus;
  readonly storageInitialized = this.offlineStorage.isInitialized;

  // Computed health status
  readonly isHealthy = computed(() => {
    const status = this._status();
    const syncStatus = this.syncStatus();
    const isOnline = this.isOnline();

    return (
      status.isInitialized &&
      status.cacheStatus !== 'error' &&
      (!isOnline || syncStatus.failedAttempts < 5)
    );
  });

  readonly canInstall = computed(() => {
    return this._installPrompt !== null && this._status().isInstallable;
  });

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Wait for storage to be ready
      if (!this.offlineStorage.isInitialized()) {
        await new Promise<void>((resolve) => {
          const checkStorage = () => {
            if (this.offlineStorage.isInitialized()) {
              resolve();
            } else {
              setTimeout(checkStorage, 100);
            }
          };
          checkStorage();
        });
      }

      // Setup service worker if available
      if (this.swUpdate?.isEnabled) {
        this.setupServiceWorker();
      }

      // Setup PWA install prompt
      this.setupInstallPrompt();

      // Setup persistent storage
      if (this.config.enablePersistentStorage) {
        await this.requestPersistentStorage();
      }

      // Monitor storage usage
      this.monitorStorageUsage();

      // Setup periodic cache validation
      this.setupCacheValidation();

      this._status.update((current) => ({
        ...current,
        isInitialized: true,
      }));

      console.log('Offline-first service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline-first service:', error);
      this._status.update((current) => ({
        ...current,
        cacheStatus: 'error',
      }));
    }
  }

  private setupServiceWorker(): void {
    if (!this.swUpdate) return;

    // Check for updates
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        switchMap(() => {
          this._status.update((current) => ({ ...current, hasUpdate: true }));

          if (this.config.enableAutoUpdate) {
            return this.swUpdate!.activateUpdate();
          }
          return EMPTY;
        }),
        catchError((error) => {
          console.error('Service worker update failed:', error);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        if (this.config.enableAutoUpdate) {
          window.location.reload();
        }
      });

    // Check for updates periodically
    if (this.swUpdate.isEnabled) {
      setInterval(() => {
        this.swUpdate!.checkForUpdate().catch((error) => {
          console.error('Update check failed:', error);
        });
      }, 60000); // Check every minute
    }
  }

  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this._installPrompt = event;
      this._status.update((current) => ({ ...current, isInstallable: true }));
    });

    window.addEventListener('appinstalled', () => {
      this._installPrompt = null;
      this._status.update((current) => ({ ...current, isInstallable: false }));
      console.log('PWA installed successfully');
    });
  }

  private async requestPersistentStorage(): Promise<void> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersistent = await navigator.storage.persist();
        console.log(`Persistent storage: ${isPersistent ? 'granted' : 'denied'}`);
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
      }
    }
  }

  private async monitorStorageUsage(): Promise<void> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const updateUsage = async () => {
        try {
          const estimate = await navigator.storage.estimate();
          this._status.update((current) => ({
            ...current,
            storageUsage: estimate.usage || 0,
            storageQuota: estimate.quota || 0,
          }));
        } catch (error) {
          console.error('Failed to estimate storage:', error);
        }
      };

      // Update immediately and then every 30 seconds
      await updateUsage();
      setInterval(updateUsage, 30000);
    }
  }

  private setupCacheValidation(): void {
    // Validate cache freshness periodically
    setInterval(async () => {
      try {
        await this.validateCache();
      } catch (error) {
        console.error('Cache validation failed:', error);
        this._status.update((current) => ({ ...current, cacheStatus: 'error' }));
      }
    }, 300000); // Every 5 minutes
  }

  private async validateCache(): Promise<void> {
    if (!this.networkStatus.isOnline()) {
      return;
    }

    try {
      // Simple connectivity test
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this._status.update((current) => ({ ...current, cacheStatus: 'fresh' }));
      } else {
        this._status.update((current) => ({ ...current, cacheStatus: 'stale' }));
      }
    } catch (error) {
      this._status.update((current) => ({ ...current, cacheStatus: 'stale' }));
    }
  }

  // Public API methods
  async installApp(): Promise<boolean> {
    if (!this._installPrompt) {
      return false;
    }

    try {
      await this._installPrompt.prompt();
      const result = await this._installPrompt.userChoice;

      if (result.outcome === 'accepted') {
        this._installPrompt = null;
        this._status.update((current) => ({ ...current, isInstallable: false }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('App installation failed:', error);
      return false;
    }
  }

  async updateApp(): Promise<void> {
    if (!this.swUpdate?.isEnabled || !this._status().hasUpdate) {
      return;
    }

    try {
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.error('App update failed:', error);
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      // Clear offline storage
      await this.offlineStorage.clearAllData();

      // Clear sync queue
      await this.dataSync.clearSyncQueue();

      // Clear caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Clear local storage (except essential data)
      const keysToPreserve = ['midi_app_config', 'user_preferences'];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      console.log('All offline data cleared successfully');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }

  async exportOfflineData(): Promise<Blob> {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        storage: await this.offlineStorage.exportData(),
        sync: await this.dataSync.exportSyncableData(),
        config: this.config,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      return new Blob([jsonString], { type: 'application/json' });
    } catch (error) {
      console.error('Failed to export offline data:', error);
      throw error;
    }
  }

  async importOfflineData(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.storage) {
        await this.offlineStorage.importData(data.storage);
      }

      if (data.sync) {
        await this.dataSync.importSyncableData(data.sync);
      }

      console.log('Offline data imported successfully');
    } catch (error) {
      console.error('Failed to import offline data:', error);
      throw error;
    }
  }

  updateConfig(newConfig: Partial<OfflineFirstConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update related services
    this.dataSync.updateConfig({
      autoSyncInterval: this.config.syncInterval,
      enableBackgroundSync: this.config.enableBackgroundSync,
    });
  }

  getConfig(): OfflineFirstConfig {
    return { ...this.config };
  }

  // Health check and diagnostics
  async runDiagnostics(): Promise<{
    overall: 'healthy' | 'warning' | 'error';
    checks: Array<{ name: string; status: 'pass' | 'fail' | 'warning'; message: string }>;
  }> {
    const checks = [];

    // Storage check
    try {
      await this.offlineStorage.getAllPatterns();
      checks.push({
        name: 'Offline Storage',
        status: 'pass' as const,
        message: 'Storage is accessible and functional',
      });
    } catch (error) {
      checks.push({
        name: 'Offline Storage',
        status: 'fail' as const,
        message: `Storage error: ${error}`,
      });
    }

    // Network status check
    if (this.networkStatus.isOnline()) {
      checks.push({
        name: 'Network Connectivity',
        status: 'pass' as const,
        message: 'Online and connected',
      });
    } else {
      checks.push({
        name: 'Network Connectivity',
        status: 'warning' as const,
        message: 'Currently offline',
      });
    }

    // Sync health check
    const syncHealth = this.dataSync.getSyncHealth();
    const syncStatus: 'pass' | 'warning' = syncHealth.isHealthy ? 'pass' : 'warning';
    checks.push({
      name: 'Data Synchronization',
      status: syncStatus,
      message: syncHealth.isHealthy ? 'Sync is healthy' : `Issues: ${syncHealth.issues.join(', ')}`,
    });

    // Service worker check
    if (this.swUpdate?.isEnabled) {
      checks.push({
        name: 'Service Worker',
        status: 'pass' as const,
        message: 'Service worker is active',
      });
    } else {
      checks.push({
        name: 'Service Worker',
        status: 'warning' as const,
        message: 'Service worker not available',
      });
    }

    // Storage quota check
    const status = this._status();
    if (status.storageQuota > 0) {
      const usagePercent = (status.storageUsage / status.storageQuota) * 100;
      if (usagePercent > 90) {
        checks.push({
          name: 'Storage Quota',
          status: 'warning' as const,
          message: `Storage is ${usagePercent.toFixed(1)}% full`,
        });
      } else {
        checks.push({
          name: 'Storage Quota',
          status: 'pass' as const,
          message: `Storage usage: ${usagePercent.toFixed(1)}%`,
        });
      }
    }

    // Determine overall status
    const hasErrors = checks.some((check) => check.status === 'fail');
    const hasWarnings = checks.some((check) => check.status === 'warning');

    const overall = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy';

    return { overall, checks };
  }

  // Utility methods
  getStorageUsageFormatted(): string {
    const status = this._status();
    const usageMB = status.storageUsage / (1024 * 1024);
    const quotaMB = status.storageQuota / (1024 * 1024);

    if (quotaMB > 0) {
      return `${usageMB.toFixed(1)} / ${quotaMB.toFixed(1)} MB`;
    }

    return `${usageMB.toFixed(1)} MB`;
  }

  isStorageQuotaExceeded(): boolean {
    const status = this._status();
    if (status.storageQuota === 0) return false;

    const usagePercent = (status.storageUsage / status.storageQuota) * 100;
    return usagePercent > 95;
  }
}
