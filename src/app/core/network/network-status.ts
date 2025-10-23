import { Injectable, signal, computed, effect } from '@angular/core';

export interface NetworkInfo {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NetworkStatusService {
  // Core network state signals
  private _isOnline = signal(navigator.onLine);
  private _connectionInfo = signal<NetworkInfo>({ isOnline: navigator.onLine });
  private _lastOnlineTime = signal<number>(Date.now());
  private _lastOfflineTime = signal<number | null>(null);

  // Public readonly signals
  readonly isOnline = this._isOnline.asReadonly();
  readonly connectionInfo = this._connectionInfo.asReadonly();
  readonly lastOnlineTime = this._lastOnlineTime.asReadonly();
  readonly lastOfflineTime = this._lastOfflineTime.asReadonly();

  // Computed signals for derived state
  readonly isOffline = computed(() => !this._isOnline());
  readonly connectionQuality = computed(() => {
    const info = this._connectionInfo();
    if (!info.isOnline) return 'offline';

    const effectiveType = info.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'poor';
    if (effectiveType === '3g') return 'good';
    if (effectiveType === '4g' || effectiveType === '5g') return 'excellent';

    return 'unknown';
  });

  readonly offlineDuration = computed(() => {
    const offlineTime = this._lastOfflineTime();
    if (!offlineTime || this._isOnline()) return 0;
    return Date.now() - offlineTime;
  });

  // Event callbacks
  private onlineCallbacks: Array<() => void> = [];
  private offlineCallbacks: Array<() => void> = [];

  constructor() {
    this.setupEventListeners();
    this.updateConnectionInfo();

    // Effect to track online/offline transitions
    effect(() => {
      const isOnline = this._isOnline();
      if (isOnline) {
        this._lastOnlineTime.set(Date.now());
        this._lastOfflineTime.set(null);
        this.notifyOnlineCallbacks();
      } else {
        this._lastOfflineTime.set(Date.now());
        this.notifyOfflineCallbacks();
      }
    });
  }

  private setupEventListeners(): void {
    // Basic online/offline events
    window.addEventListener('online', () => {
      this._isOnline.set(true);
      this.updateConnectionInfo();
    });

    window.addEventListener('offline', () => {
      this._isOnline.set(false);
      this.updateConnectionInfo();
    });

    // Network Information API (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      connection.addEventListener('change', () => {
        this.updateConnectionInfo();
      });
    }

    // Periodic connectivity check
    this.startPeriodicCheck();
  }

  private updateConnectionInfo(): void {
    const isOnline = navigator.onLine;
    const info: NetworkInfo = { isOnline };

    // Add Network Information API data if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      info.effectiveType = connection.effectiveType;
      info.downlink = connection.downlink;
      info.rtt = connection.rtt;
      info.saveData = connection.saveData;
    }

    this._connectionInfo.set(info);
    this._isOnline.set(isOnline);
  }

  private startPeriodicCheck(): void {
    // Check connectivity every 30 seconds when online
    // Check more frequently when offline to detect reconnection
    setInterval(
      () => {
        const checkInterval = this._isOnline() ? 30000 : 5000;
        this.performConnectivityCheck();
      },
      this._isOnline() ? 30000 : 5000,
    );
  }

  private async performConnectivityCheck(): Promise<void> {
    try {
      // Try to fetch a small resource to verify actual connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const isActuallyOnline = response.ok;

      // Update state if it differs from navigator.onLine
      if (isActuallyOnline !== this._isOnline()) {
        this._isOnline.set(isActuallyOnline);
        this.updateConnectionInfo();
      }
    } catch (error) {
      // If fetch fails, we're likely offline
      if (this._isOnline()) {
        this._isOnline.set(false);
        this.updateConnectionInfo();
      }
    }
  }

  // Public methods for subscribing to network events
  onOnline(callback: () => void): () => void {
    this.onlineCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.onlineCallbacks.indexOf(callback);
      if (index > -1) {
        this.onlineCallbacks.splice(index, 1);
      }
    };
  }

  onOffline(callback: () => void): () => void {
    this.offlineCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.offlineCallbacks.indexOf(callback);
      if (index > -1) {
        this.offlineCallbacks.splice(index, 1);
      }
    };
  }

  private notifyOnlineCallbacks(): void {
    this.onlineCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in online callback:', error);
      }
    });
  }

  private notifyOfflineCallbacks(): void {
    this.offlineCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in offline callback:', error);
      }
    });
  }

  // Utility methods
  async waitForOnline(timeout?: number): Promise<void> {
    if (this._isOnline()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const unsubscribe = this.onOnline(() => {
        unsubscribe();
        resolve();
      });

      if (timeout) {
        setTimeout(() => {
          unsubscribe();
          reject(new Error('Timeout waiting for online connection'));
        }, timeout);
      }
    });
  }

  // Check if we have a good enough connection for certain operations
  canPerformHeavyOperation(): boolean {
    const quality = this.connectionQuality();
    return quality === 'good' || quality === 'excellent';
  }

  canPerformBasicOperation(): boolean {
    return this._isOnline();
  }

  shouldUseCachedData(): boolean {
    const info = this._connectionInfo();
    return !info.isOnline || info.saveData === true || this.connectionQuality() === 'poor';
  }
}
