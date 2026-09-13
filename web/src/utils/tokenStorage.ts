const REFRESH_TOKEN_KEY = 'ef_refresh_token';

// In-memory storage for short-lived (15 min) JWT access token
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Storage access might be restricted in some iframe contexts
  }
}

export function clearAuthTokens(): void {
  inMemoryAccessToken = null;
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Synchronizes logout across multiple browser tabs.
 * If user logs out in Tab A, Tab B receives storage event and invokes callback.
 */
export function listenToStorageEvents(onCrossTabLogout: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === REFRESH_TOKEN_KEY && e.newValue === null) {
      inMemoryAccessToken = null;
      onCrossTabLogout();
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
