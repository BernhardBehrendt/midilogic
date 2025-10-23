import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkStatusService } from '../../core/network/network-status';
import { DataSyncService } from '../../core/sync/data-sync';

@Component({
  selector: 'ml-offline-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-indicator.html',
})
export class OfflineIndicatorComponent {
  private networkStatus = inject(NetworkStatusService);
  private dataSync = inject(DataSyncService);

  // Network status signals
  readonly isOnline = this.networkStatus.isOnline;
  readonly connectionQuality = this.networkStatus.connectionQuality;
  readonly offlineDuration = this.networkStatus.offlineDuration;

  // Sync status signals
  readonly syncStatus = this.dataSync.syncStatus;
  readonly syncProgress = this.dataSync.syncProgress;

  // Computed display values
  readonly statusText = computed(() => {
    const isOnline = this.isOnline();
    const syncStatus = this.syncStatus();
    const quality = this.connectionQuality();

    if (!isOnline) {
      const duration = this.offlineDuration();
      if (duration > 0) {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return minutes > 0 ? `Offline for ${minutes}m ${seconds}s` : `Offline for ${seconds}s`;
      }
      return 'Offline';
    }

    if (syncStatus.isSyncing) {
      return `Syncing... (${this.syncProgress()}%)`;
    }

    if (syncStatus.pendingChanges > 0) {
      return `${syncStatus.pendingChanges} changes pending`;
    }

    if (quality === 'poor') {
      return 'Online (poor connection)';
    }

    return 'Online';
  });

  readonly shouldShowIndicator = computed(() => {
    const isOnline = this.isOnline();
    const syncStatus = this.syncStatus();

    // Always show when offline
    if (!isOnline) return true;

    // Show when syncing or have pending changes
    if (syncStatus.isSyncing || syncStatus.pendingChanges > 0) return true;

    // Show when there's an error
    if (syncStatus.error) return true;

    // Show when connection is poor
    if (this.connectionQuality() === 'poor') return true;

    return false;
  });

  readonly iconClass = computed(() => {
    const isOnline = this.isOnline();
    const syncStatus = this.syncStatus();

    if (!isOnline) return 'bi-wifi-off';
    if (syncStatus.isSyncing) return 'bi-arrow-clockwise';
    if (syncStatus.error) return 'bi-exclamation-triangle';
    if (syncStatus.pendingChanges > 0) return 'bi-cloud-upload';
    return 'bi-wifi';
  });

  // Get DaisyUI alert class based on status
  getAlertClass(): string {
    const isOnline = this.isOnline();
    const syncStatus = this.syncStatus();
    const quality = this.connectionQuality();

    if (!isOnline) return 'alert-error';
    if (syncStatus.isSyncing) return 'alert-info';
    if (syncStatus.error) return 'alert-error';
    if (syncStatus.pendingChanges > 0) return 'alert-warning';
    if (quality === 'poor') return 'alert-warning';
    return 'alert-success';
  }

  // Get connection quality dot classes
  getQualityDotClass(dotNumber: 1 | 2 | 3): string {
    const quality = this.connectionQuality();
    const baseClass = 'bg-base-300';

    switch (quality) {
      case 'excellent':
        return 'bg-success';
      case 'good':
        return dotNumber <= 2 ? 'bg-warning' : baseClass;
      case 'poor':
        return dotNumber === 1 ? 'bg-error' : baseClass;
      default:
        return baseClass;
    }
  }

  // Manual sync trigger
  async triggerSync(): Promise<void> {
    if (this.isOnline() && !this.syncStatus().isSyncing) {
      try {
        await this.dataSync.forceSyncAll();
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  }
}
