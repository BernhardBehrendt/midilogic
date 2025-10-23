import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OfflineFirstService } from '../../core/offline-first';

@Component({
  selector: 'ml-pwa-install',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pwa-install.html',
})
export class PwaInstallComponent {
  private offlineFirst = inject(OfflineFirstService);

  readonly status = this.offlineFirst.status;
  readonly canInstall = this.offlineFirst.canInstall;

  readonly showInstallButton = computed(() => {
    return this.canInstall() && this.status().isInitialized;
  });

  readonly showUpdateButton = computed(() => {
    return this.status().hasUpdate;
  });

  async installApp(): Promise<void> {
    try {
      const success = await this.offlineFirst.installApp();
      if (success) {
        console.log('App installed successfully');
      }
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
}
