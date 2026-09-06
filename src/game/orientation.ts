import { onLocaleChanged, t } from '../i18n';

/**
 * Portrait guard for phones. The game is laid out for a 16:9 landscape canvas, and squeezing it
 * into a portrait window would letterbox it down to an unplayable strip, so a coarse-pointer device
 * held upright gets a rotate prompt instead. It is a DOM overlay rather than a Phaser scene because
 * it has to cover the canvas whatever the game is doing, including while loading.
 */
const ID = 'orientation-gate';

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
    gate.classList.toggle('visible', portrait && isCoarsePointer());
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
  };
}
