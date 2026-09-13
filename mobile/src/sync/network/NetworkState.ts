/**
 * Network State Manager (Section 31)
 *
 * Centralizes network connectivity monitoring using NetInfo.
 * Shields UI components from raw NetInfo calls and provides a mockable interface for tests.
 */

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

type NetworkListener = (status: NetworkStatus) => void;

export class NetworkStateManager {
  private static instance: NetworkStateManager | null = null;
  private currentStatus: NetworkStatus = {
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  };
  private listeners: Set<NetworkListener> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;

  private constructor() {
    this.init();
  }

  static getInstance(): NetworkStateManager {
    if (!NetworkStateManager.instance) {
      NetworkStateManager.instance = new NetworkStateManager();
    }
    return NetworkStateManager.instance;
  }

  private init(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo = require('@react-native-community/netinfo');
      this.unsubscribeNetInfo = NetInfo.addEventListener((state: any) => {
        this.currentStatus = {
          isConnected: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? true,
          type: state.type ?? 'unknown',
        };
        this.notify();
      });
    } catch {
      // In non-native test environments, defaults to connected
    }
  }

  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  isOnline(): boolean {
    return this.currentStatus.isConnected && (this.currentStatus.isInternetReachable !== false);
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentStatus);
    }
  }

  /**
   * For testing purposes: manually simulate online/offline state
   */
  setMockStatus(status: Partial<NetworkStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.notify();
  }

  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners.clear();
  }
}
