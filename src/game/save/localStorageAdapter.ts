import type { SaveStorage } from '../../core/save/saveData';
import { SAVE_KEY } from '../../config';

export class LocalStorageAdapter implements SaveStorage {
  read(): string | null {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  }

  write(s: string): void {
    try {
      localStorage.setItem(SAVE_KEY, s);
    } catch {
      /* storage may be unavailable (private mode); the run still works */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}
