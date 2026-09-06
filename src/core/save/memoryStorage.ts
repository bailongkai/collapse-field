import type { SaveStorage } from './saveData';

/** In-memory SaveStorage used by unit tests and by the game under ?test=1. */
export class MemoryStorage implements SaveStorage {
  private value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(s: string): void {
    this.value = s;
  }

  clear(): void {
    this.value = null;
  }
}
