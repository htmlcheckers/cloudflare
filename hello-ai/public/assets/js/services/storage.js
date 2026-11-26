/**
 * localStorage wrapper that never throws (private mode, quota, disabled storage)
 * and keeps an in-memory fallback so settings still work for the session.
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  const fallback = new Map();
  return {
    get(key, defaultValue = null) {
      try {
        const value = getBackend().getItem(key);
        if (value != null) {
          fallback.set(key, value);
          return value;
        }
      } catch (error) {
        console.warn(`Could not read local setting "${key}":`, error);
      }
      return fallback.has(key) ? fallback.get(key) : defaultValue;
    },
    set(key, value) {
      fallback.set(key, String(value));
      try {
        getBackend().setItem(key, String(value));
        return true;
      } catch (error) {
        console.warn(`Could not save local setting "${key}":`, error);
        return false;
      }
    },
    remove(key) {
      fallback.delete(key);
      try {
        getBackend().removeItem(key);
      } catch {
        /* ignore */
      }
    }
  };
}
