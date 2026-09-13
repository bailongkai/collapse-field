/**
 * Events the game reports about itself. On the web they go to the console in debug and to a ring
 * buffer the debug hook can read; a native provider is one function away. Nothing here is on the
 * simulation side, so nothing here can change a run.
 */
export type AnalyticsEvent =
  /** `runIndex` is how many runs this save has ever started, `sessionRun` how many since launch */
  | { name: 'run_start'; stage: string; character: string; curse: number; runIndex: number; sessionRun: number }
  /**
   * One wide event per run, and the only one that has to be complete: every started run ends here,
   * including the ones abandoned from the pause menu, or the funnel is open and the survival curve
   * only describes the players the game already suits. `seed` is what makes a death reproducible —
   * the simulation is deterministic, so seed plus stage plus character replays the exact run.
   */
  | {
      name: 'run_end';
      stage: string;
      character: string;
      timeSec: number;
      minute: number;
      level: number;
      kills: number;
      cause: string;
      curse: number;
      runIndex: number;
      build: string;
      evolutions: number;
      bossKills: number;
      chests: number;
      revives: number;
      adRevived: boolean;
      gold: number;
      seed: number;
    }
  /**
   * `offered` is the whole point: the level-up offer is deliberately weighted, so a pick count on
   * its own measures the weighting rather than what players want. Selection rate is picks over
   * times offered, and that needs both halves of the same event.
   */
  | { name: 'levelup_pick'; action: string; kind: string; id: string; toLevel: number; level: number; offered: string }
  | { name: 'chest_open'; grade: string; rewards: number }
  | { name: 'weapon_evolved'; id: string; timeSec: number; level: number }
  | { name: 'unlock'; kind: string; id: string }
  | { name: 'ad_offer'; kind: string }
  | { name: 'ad_shown'; kind: string; earned: boolean; result: string }
  | { name: 'purchase'; id: string; ok: boolean }
  | { name: 'tutorial_begin' }
  | { name: 'tutorial_done'; sec: number };

export type AnalyticsSink = (e: AnalyticsEvent) => void;

const buffer: AnalyticsEvent[] = [];
let sink: AnalyticsSink | null = null;
let debug = false;

export const analytics = {
  configure(o: { debug: boolean; sink?: AnalyticsSink }): void {
    debug = o.debug;
    sink = o.sink ?? null;
  },
  track(e: AnalyticsEvent): void {
    buffer.push(e);
    if (buffer.length > 200) buffer.shift();
    if (debug) console.info('[analytics]', e);
    try {
      sink?.(e);
    } catch (error) {
      console.warn('analytics sink failed', error);
    }
  },
  recent(): readonly AnalyticsEvent[] {
    return buffer;
  },
};
