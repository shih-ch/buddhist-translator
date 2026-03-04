import type { SavedVersion } from '@/types/translator';

const VERSIONS_KEY_PREFIX = 'bt-saved-versions';

export function loadVersions(): SavedVersion[] {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY_PREFIX);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function persistVersions(versions: SavedVersion[]): boolean {
  try {
    localStorage.setItem(VERSIONS_KEY_PREFIX, JSON.stringify(versions));
    return true;
  } catch {
    return false;
  }
}
