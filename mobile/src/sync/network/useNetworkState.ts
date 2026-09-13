import { useEffect, useState } from 'react';
import { NetworkStateManager, NetworkStatus } from './NetworkState';

export function useNetworkState() {
  const manager = NetworkStateManager.getInstance();
  const [status, setStatus] = useState<NetworkStatus>(manager.getStatus());

  useEffect(() => {
    const unsubscribe = manager.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, [manager]);

  const isOnline = status.isConnected && (status.isInternetReachable !== false);

  return {
    ...status,
    isOnline,
    isOffline: !isOnline,
  };
}
