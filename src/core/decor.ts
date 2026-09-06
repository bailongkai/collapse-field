import { hash2 } from './rng';

export interface DecorSlot {
  x: number;
  y: number;
  frame: number;
  rotation: number;
  scale: number;
}

/**
 * Wraps a decoration around the camera so a fixed pool covers an infinite floor. When a slot wraps
 * it lands in a new integer cell, and its frame/rotation are re-rolled from a hash of that cell, so
 * the layout never visibly repeats and is identical for the same camera path.
 */
export function wrapDecor(slot: DecorSlot, camX: number, camY: number, viewW: number, viewH: number, frameCount: number): boolean {
  const spanX = viewW + 512;
  const spanY = viewH + 512;
  let wrapped = false;
  while (slot.x - camX > spanX / 2) {
    slot.x -= spanX;
    wrapped = true;
  }
  while (camX - slot.x > spanX / 2) {
    slot.x += spanX;
    wrapped = true;
  }
  while (slot.y - camY > spanY / 2) {
    slot.y -= spanY;
    wrapped = true;
  }
  while (camY - slot.y > spanY / 2) {
    slot.y += spanY;
    wrapped = true;
  }
  if (wrapped) reroll(slot, frameCount);
  return wrapped;
}

/** Deterministically picks the frame, rotation and scale from the integer cell the slot sits in. */
export function reroll(slot: DecorSlot, frameCount: number): void {
  const cx = Math.floor(slot.x / 1792);
  const cy = Math.floor(slot.y / 1232);
  const h = hash2(cx * 7919 + Math.round(slot.x / 97), cy * 104729 + Math.round(slot.y / 89));
  slot.frame = h % frameCount;
  slot.rotation = ((h >>> 8) % 4) * (Math.PI / 2);
  slot.scale = 0.8 + (((h >>> 16) % 40) / 100);
}
