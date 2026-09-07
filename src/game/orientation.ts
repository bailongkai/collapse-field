import { onLocaleChanged, t } from '../i18n';

/**
 * Portrait guard for phones. The game is laid out for a 16:9 landscape canvas, and squeezing it
 * into a portrait window would letterbox it down to an unplayable strip, so a coarse-pointer device
 * held upright gets a rotate prompt instead. It is a DOM overlay rather than a Phaser scene because
 * it has to cover the canvas whatever the game is doing, including while loading.
 */
const ID = 'orientation-gate';

export type GateListener = (visible: boolean) => void;

const listeners = new Set<GateListener>();
let gateVisible = false;

/** Subscribe to the portrait gate opening and closing. Returns an unsubscribe function. */
export function onOrientationGate(fn: GateListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isOrientationGateVisible(): boolean {
  return gateVisible;
}

export function installOrientationGate(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const gate = document.createElement('div');
  gate.id = ID;
  gate.innerHTML = '<div class="rotate-icon">⟳</div><p class="rotate-title"></p><p class="rotate-hint"></p>';
  document.body.appendChild(gate);

  const title = gate.querySelector('.rotate-title') as HTMLElement;
  const hint = gate.querySelector('.rotate-hint') as HTMLElement;

  const applyText = (): void => {
    title.textContent = t('orientation.rotate');
    hint.textContent = t('orientation.hint');
  };

  const isCoarsePointer = (): boolean =>
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  const update = (): void => {
    const portrait = window.innerHeight > window.innerWidth;
    const visible = portrait && isCoarsePointer();
    if (visible === gateVisible) return;
    gateVisible = visible;
    gate.classList.toggle('visible', visible);
    // the gate covers the canvas but the run keeps stepping behind it, so the player would be
    // killed by a horde they cannot see or steer away from
    for (const l of [...listeners]) l(visible);
  };

  applyText();
  update();

  const offLocale = onLocaleChanged(applyText);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);

  return () => {
    offLocale();
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    gate.remove();
    listeners.clear();
    gateVisible = false;
  };
}
