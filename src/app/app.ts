import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineIndicatorComponent } from './shared/offline-indicator/offline-indicator';
import { PwaInstallComponent } from './shared/pwa-install/pwa-install';
import { OfflineFirstService } from './core/offline-first';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, OfflineIndicatorComponent, PwaInstallComponent],
  template: `
    <div class="app-container">
      <!-- PWA Install Banner -->
      <ml-pwa-install></ml-pwa-install>

      <!-- Main app content -->
      <router-outlet></router-outlet>

      <!-- Offline status indicator -->
      <ml-offline-indicator></ml-offline-indicator>
    </div>
  `,
  styles: [
    `
      .app-container {
        min-height: 100vh;
        position: relative;
      }
    `,
  ],
})
export class App implements OnInit {
  title = 'MidiLogic';

  private offlineFirst = inject(OfflineFirstService);

  ngOnInit(): void {
    // Initialize offline-first functionality
    // The service will handle its own initialization
    console.log('MidiLogic app initialized with offline-first capabilities');
  }
}
