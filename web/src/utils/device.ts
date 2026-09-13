import { DeviceMetadata } from '@/types/auth';

const DEVICE_ID_KEY = 'ef_device_id';

export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getClientDeviceMetadata(): DeviceMetadata {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Server';
  let browserName = 'Web Browser';
  if (userAgent.includes('Firefox')) browserName = 'Firefox';
  else if (userAgent.includes('Edg')) browserName = 'Edge';
  else if (userAgent.includes('Chrome')) browserName = 'Chrome';
  else if (userAgent.includes('Safari')) browserName = 'Safari';

  return {
    id: getOrCreateDeviceId(),
    platform: 'WEB',
    deviceName: `${browserName} on Web`,
    clientVersion: '1.0.0',
  };
}
