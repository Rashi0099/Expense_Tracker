/**
 * Client-Side UUID Generation Strategy (Section 23)
 *
 * Generates RFC 4122 v4 / UUIDv7 compliant unique identifiers on the mobile device
 * before committing mutations to SQLite. This enables offline record creation where
 * the local entity and its corresponding sync_outbox item share authoritative identity.
 */

export function generateUUID(): string {
  // Use crypto.randomUUID if available in the JS runtime
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback RFC 4122 v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
