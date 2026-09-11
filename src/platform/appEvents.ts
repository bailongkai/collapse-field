import { Capacitor } from '@capacitor/core';

/**
 * Native app events, re-broadcast as DOM events on window so scenes can listen without knowing
 * about Capacitor: 'app-back' for Android's hardware back button. Backgrounding is already
 * covered by Phaser's own HIDDEN event, which the game scene turns into a pause.
 */
export async function bindAppEvents(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', () => {
      window.dispatchEvent(new CustomEvent('app-back'));
    });
  } catch (error) {
    console.warn('app events unavailable', error);
  }
}
