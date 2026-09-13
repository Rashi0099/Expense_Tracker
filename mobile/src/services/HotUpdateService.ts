import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import axios from 'axios';
import { ENV } from '../app/config/env';

const { HotUpdateModule } = NativeModules;

export interface OtaVersionInfo {
  version: string;
  bundleUrl: string;
  releaseNotes?: string;
  minAppVersion?: string;
}

export interface UpdateCheckResult {
  isAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  bundleUrl?: string;
  releaseNotes?: string;
}

export type DownloadProgressCallback = (progress: {
  percentage: number;
  bytesDownloaded: number;
  totalBytes: number;
}) => void;

class HotUpdateService {
  private static instance: HotUpdateService;
  private eventEmitter: NativeEventEmitter | null = null;

  private constructor() {
    if (Platform.OS === 'android' && HotUpdateModule) {
      this.eventEmitter = new NativeEventEmitter(HotUpdateModule);
    }
  }

  public static getInstance(): HotUpdateService {
    if (!HotUpdateService.instance) {
      HotUpdateService.instance = new HotUpdateService();
    }
    return HotUpdateService.instance;
  }

  /**
   * Returns current active OTA version, or base client version if no OTA applied.
   */
  public async getCurrentVersion(): Promise<string> {
    if (Platform.OS !== 'android' || !HotUpdateModule) {
      return ENV.CLIENT_VERSION;
    }
    try {
      const otaVersion = await HotUpdateModule.getCurrentOtaVersion();
      return otaVersion || ENV.CLIENT_VERSION;
    } catch {
      return ENV.CLIENT_VERSION;
    }
  }

  /**
   * Checks the server for an available OTA hot update.
   */
  public async checkForUpdate(): Promise<UpdateCheckResult> {
    const currentVersion = await this.getCurrentVersion();

    if (Platform.OS !== 'android' || !HotUpdateModule) {
      return { isAvailable: false, currentVersion };
    }

    try {
      const manifestUrl = `${ENV.API_BASE_URL.replace('/api/v1', '')}/ota/version.json`;
      const response = await axios.get<OtaVersionInfo>(manifestUrl, {
        timeout: 8000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      const data = response.data;
      if (!data || !data.version || !data.bundleUrl) {
        return { isAvailable: false, currentVersion };
      }

      const isNewer = this.compareVersions(data.version, currentVersion) > 0;

      return {
        isAvailable: isNewer,
        currentVersion,
        latestVersion: data.version,
        bundleUrl: data.bundleUrl,
        releaseNotes: data.releaseNotes,
      };
    } catch {
      // Offline or manifest not reachable
      return { isAvailable: false, currentVersion };
    }
  }

  /**
   * Downloads and applies the OTA bundle with real-time percentage progress.
   */
  public async downloadUpdate(
    bundleUrl: string,
    targetVersion: string,
    onProgress?: DownloadProgressCallback
  ): Promise<boolean> {
    if (Platform.OS !== 'android' || !HotUpdateModule) {
      return false;
    }

    let subscription: { remove: () => void } | null = null;

    if (this.eventEmitter && onProgress) {
      subscription = this.eventEmitter.addListener('onDownloadProgress', (event) => {
        onProgress({
          percentage: event.percentage || 0,
          bytesDownloaded: event.bytesDownloaded || 0,
          totalBytes: event.totalBytes || 0,
        });
      });
    }

    try {
      await HotUpdateModule.downloadUpdate(bundleUrl, targetVersion);
      return true;
    } finally {
      if (subscription) {
        subscription.remove();
      }
    }
  }

  /**
   * Restarts the application cleanly to apply the newly downloaded bundle.
   */
  public reloadApp(): void {
    if (Platform.OS === 'android' && HotUpdateModule) {
      HotUpdateModule.reloadApp();
    }
  }

  /**
   * Reverts to the default APK bundle.
   */
  public async clearUpdates(): Promise<void> {
    if (Platform.OS === 'android' && HotUpdateModule) {
      await HotUpdateModule.clearUpdates();
    }
  }

  /**
   * Simple semver-like comparison (e.g. 1.0.1 > 1.0.0).
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.replace(/[^0-9.]/g, '').split('.').map(Number);
    const parts2 = v2.replace(/[^0-9.]/g, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}

export const hotUpdateService = HotUpdateService.getInstance();
