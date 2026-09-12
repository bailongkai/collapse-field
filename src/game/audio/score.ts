/**
 * The score, as data. Everything here is arithmetic — no Web Audio, no Phaser — so the arrangement
 * can be read and tested on its own, and `music.ts` is left with nothing to do but make sound.
 *
 * The piece is in A minor over a four-bar loop, sixteen steps to the bar. What changes between the
 * menu, an ordinary fight, a boss and the final boss is the tempo, which layers play, and how busy
 * the arpeggio is; the harmony stays put so a transition never sounds like a different game.
 */
export type Mood = 'menu' | 'battle' | 'boss' | 'final';

export interface MoodConfig {
  bpm: number;
  /** layer gains, 0 = silent */
  pad: number;
  bass: number;
  arp: number;
  drums: number;
  /** how far the low-pass on the pad opens: brighter means tenser */
  brightness: number;
}

export const MOODS: Readonly<Record<Mood, MoodConfig>> = {
  // the menu is the same world heard from outside it: pad and a few notes, no pulse
  menu: { bpm: 84, pad: 1, bass: 0.35, arp: 0.5, drums: 0, brightness: 0.25 },
  battle: { bpm: 104, pad: 0.85, bass: 0.9, arp: 0.8, drums: 0.8, brightness: 0.5 },
  boss: { bpm: 124, pad: 0.7, bass: 1, arp: 0.9, drums: 1, brightness: 0.8 },
  final: { bpm: 132, pad: 0.6, bass: 1, arp: 1, drums: 1, brightness: 1 },
};

export const STEPS_PER_BAR = 16;
export const BARS = 4;
export const LOOP_STEPS = STEPS_PER_BAR * BARS;

/** A1 = 55 Hz; every pitch in the piece is a semitone offset from it. */
export const ROOT_HZ = 55;

/** i — VI — III — VII in A minor: the root of each bar, and the triad over it. */
const PROGRESSION: readonly { root: number; chord: readonly number[] }[] = [
  { root: 0, chord: [0, 3, 7, 12] }, // Am
  { root: -4, chord: [0, 4, 7, 11] }, // F
  { root: 3, chord: [0, 4, 7, 10] }, // C
  { root: -2, chord: [0, 4, 7, 10] }, // G
];

export function chordForBar(bar: number): { root: number; chord: readonly number[] } {
  return PROGRESSION[((bar % BARS) + BARS) % BARS];
}

export function semitoneToHz(semitones: number): number {
  return ROOT_HZ * Math.pow(2, semitones / 12);
}

export interface StepEvents {
  kick: boolean;
  snare: boolean;
  hat: boolean;
  /** semitones from the root, or null for no note this step */
  bass: number | null;
  arp: number | null;
  /** pad chord to (re)voice, only on the first step of a bar */
  pad: readonly number[] | null;
}

/**
 * What happens on one sixteenth. `intensity` (0..1) is how far into the run we are: it thickens
 * the arpeggio and adds off-beat kicks, so the same loop tightens over fifteen minutes without
 * ever changing key. `rnd` returns 0..1 and is the caller's seeded generator.
 */
export function stepEvents(mood: Mood, step: number, intensity: number, rnd: () => number): StepEvents {
  const cfg = MOODS[mood];
  const inBar = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const { root, chord } = chordForBar(bar);
  const out: StepEvents = { kick: false, snare: false, hat: false, bass: null, arp: null, pad: null };

  if (inBar === 0) out.pad = chord.map((c) => root + c);

  if (cfg.drums > 0) {
    // four to the floor once a boss is on the field; a half-time pulse before that
    out.kick = mood === 'boss' || mood === 'final' ? inBar % 4 === 0 : inBar === 0 || inBar === 8;
    if (!out.kick && intensity > 0.5 && inBar === 14) out.kick = true;
    out.snare = inBar === 4 || inBar === 12;
    out.hat = mood === 'final' ? true : inBar % 2 === 0;
  }

  if (cfg.bass > 0) {
    // root on the downbeat, fifth halfway, and a passing octave when the run is hot
    if (inBar === 0) out.bass = root - 12;
    else if (inBar === 8) out.bass = root - 5;
    else if (inBar === 6 && intensity > 0.4) out.bass = root - 12;
    else if (inBar === 11 && intensity > 0.75) out.bass = root;
  }

  if (cfg.arp > 0) {
    const density = 0.2 + intensity * 0.5 + (mood === 'menu' ? -0.1 : 0.15);
    const onBeat = inBar % 2 === 0;
    if ((onBeat || intensity > 0.6) && rnd() < density) {
      const degree = chord[Math.floor(rnd() * chord.length)];
      const octave = rnd() < 0.35 + intensity * 0.35 ? 36 : 24;
      out.arp = root + degree + octave;
    }
  }
  return out;
}

/** Seconds per sixteenth at this mood's tempo. */
export function stepSeconds(mood: Mood): number {
  return 60 / MOODS[mood].bpm / 4;
}
