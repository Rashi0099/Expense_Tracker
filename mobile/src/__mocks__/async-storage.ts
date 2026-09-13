const storage = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return storage.get(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    storage.delete(key);
  },
  clear: async (): Promise<void> => {
    storage.clear();
  },
  getAllKeys: async (): Promise<string[]> => {
    return Array.from(storage.keys());
  },
  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map((k) => [k, storage.get(k) ?? null]);
  },
  multiSet: async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([k, v]) => storage.set(k, v));
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    keys.forEach((k) => storage.delete(k));
  },
};

export default AsyncStorage;
