/** Stable-id registry of every canvas button, so tests can press them via window.__game.ui. */
export interface RegisteredButton {
  id: string;
  getPos(): { x: number; y: number };
  /** the interactive area in logical units, which may be larger than the drawn button */
  getHitSize(): { w: number; h: number };
  isEnabled(): boolean;
  press(): void;
}

const buttons = new Map<string, RegisteredButton>();

export function registerButton(b: RegisteredButton): () => void {
  buttons.set(b.id, b);
  return () => {
    if (buttons.get(b.id) === b) buttons.delete(b.id);
  };
}

export function listButtons(): { id: string; x: number; y: number; hitW: number; hitH: number; enabled: boolean }[] {
  return [...buttons.values()].map((b) => {
    const size = b.getHitSize();
    return { id: b.id, ...b.getPos(), hitW: size.w, hitH: size.h, enabled: b.isEnabled() };
  });
}

export function pressButton(id: string): boolean {
  const b = buttons.get(id);
  if (!b || !b.isEnabled()) return false;
  b.press();
  return true;
}
