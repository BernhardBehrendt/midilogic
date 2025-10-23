import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfflineFirstService } from '../../core/offline-first';
import { DataSyncService } from '../../core/sync/data-sync';
import { NetworkStatusService } from '../../core/network/network-status';

@Component({
  selector: 'ml-offline-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offline-settings.html',
})
export class OfflineSettingsComponent {
  private offlineFirst = inject(OfflineFirstService);
  private dataSync = inject(DataSyncService);
  private networkStatus = inject(NetworkStatusService);

  // Service signals
  readonly offlineStatus = this.offlineFirst.status;
  readonly syncStatus = this.dataSync.syncStatus;
  readonly networkInfo = this.networkStatus.connectionInfo;
  readonly isOnline = this.networkStatus.isOnline;

  // Local state
  readonly isExporting = signal(false);
  readonly isImporting = signal(false);
  readonly isClearingData = signal(false);
  readonly isRunningDiagnostics = signal(false);
  readonly diagnosticsResults = signal<any>(null);

  // Configuration signals
  private config = signal(this.offlineFirst.getConfig());

  readonly autoSyncEnabled = computed(() => this.config().enableBackgroundSync);
  readonly autoUpdateEnabled = computed(() => this.config().enableAutoUpdate);
  readonly persistentStorageEnabled = computed(() => this.config().enablePersistentStorage);
  readonly syncInterval = computed(() => this.config().syncInterval / 1000); // Convert to seconds

  // Computed display values
  readonly storageInfo = computed(() => {
    const status = this.offlineStatus();
    const usageMB = (status.storageUsage / (1024 * 1024)).toFixed(1);
    const quotaMB = (status.storageQuota / (1024 * 1024)).toFixed(1);
    const usagePercent =
      status.storageQuota > 0
        ? ((status.storageUsage / status.storageQuota) * 100).toFixed(1)
        : '0';

    return {
      usage: usageMB,
      quota: quotaMB,
      percent: usagePercent,
      isLow: parseFloat(usagePercent) > 90,
    };
  });

  readonly syncHealth = computed(() => {
    const status = this.syncStatus();
    if (status.error) return { status: 'error', message: status.error };
    if (status.failedAttempts > 5) return { status: 'warning', message: 'Multiple sync failures' };
    if (status.pendingChanges > 0)
      return { status: 'pending', message: `${status.pendingChanges} changes pending` };
    return { status: 'healthy', message: 'All synced' };
  });

  readonly connectionQuality = computed(() => {
    const info = this.networkInfo();
    if (!info.isOnline) return { status: 'offline', message: 'Offline' };

    const effectiveType = info.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return { status: 'poor', message: 'Poor connection' };
    }
    if (effectiveType === '3g') {
      return { status: 'good', message: 'Good connection' };
    }
    if (effectiveType === '4g' || effectiveType === '5g') {
      return { status: 'excellent', message: 'Excellent connection' };
    }
    return { status: 'unknown', message: 'Connection quality unknown' };
  });

  // Settings methods
  updateAutoSync(enabled: boolean): void {
    this.updateConfig({ enableBackgroundSync: enabled });
  }

  updateAutoUpdate(enabled: boolean): void {
    this.updateConfig({ enableAutoUpdate: enabled });
  }

  updatePersistentStorage(enabled: boolean): void {
    this.updateConfig({ enablePersistentStorage: enabled });
  }

  updateSyncInterval(seconds: number): void {
    this.updateConfig({ syncInterval: seconds * 1000 });
  }

  private updateConfig(updates: any): void {
    const newConfig = { ...this.config(), ...updates };
    this.config.set(newConfig);
    this.offlineFirst.updateConfig(updates);
  }

  // Action methods
  async forceSyncNow(): Promise<void> {
    if (!this.isOnline()) return;

    try {
      await this.dataSync.forceSyncAll();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  }

  pauseSync(): void {
    this.dataSync.pauseSync();
  }

  resumeSync(): void {
    this.dataSync.resumeSync();
  }

  async clearSyncQueue(): Promise<void> {
    try {
      await this.dataSync.clearSyncQueue();
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
    }
  }

  async exportData(): Promise<void> {
    if (this.isExporting()) return;

    this.isExporting.set(true);
    try {
      const blob = await this.offlineFirst.exportOfflineData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midilogic-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      this.isExporting.set(false);
    }
  }

  async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isImporting.set(true);
    try {
      await this.offlineFirst.importOfflineData(file);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      this.isImporting.set(false);
      input.value = ''; // Reset input
    }
  }

  async clearAllData(): Promise<void> {
    this.isClearingData.set(true);
    try {
      await this.offlineFirst.clearAllData();
    } catch (error) {
      console.error('Failed to clear data:', error);
    } finally {
      this.isClearingData.set(false);
    }
  }

  async runDiagnostics(): Promise<void> {
    if (this.isRunningDiagnostics()) return;

    this.isRunningDiagnostics.set(true);
    try {
      const results = await this.offlineFirst.runDiagnostics();
      this.diagnosticsResults.set(results);
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      this.isRunningDiagnostics.set(false);
    }
  }

  async installApp(): Promise<void> {
    try {
      await this.offlineFirst.installApp();
    } catch (error) {
      console.error('Installation failed:', error);
    }
  }

  async updateApp(): Promise<void> {
    try {
      await this.offlineFirst.updateApp();
    } catch (error) {
      console.error('Update failed:', error);
    }
  }

  // Utility methods
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'healthy':
      case 'excellent':
        return 'badge-success';
      case 'warning':
      case 'good':
      case 'pending':
        return 'badge-warning';
      case 'error':
      case 'poor':
        return 'badge-error';
      case 'offline':
        return 'badge-neutral';
      default:
        return 'badge-ghost';
    }
  }

  formatLastSync(): string {
    const lastSync = this.syncStatus().lastSyncTime;
    if (!lastSync) return 'Never';

    const diff = Date.now() - lastSync;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
}
