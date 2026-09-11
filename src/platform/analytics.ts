/**
 * Events the game reports about itself. On the web they go to the console in debug and to a ring
 * buffer the debug hook can read; a native provider is one function away. Nothing here is on the
 * simulation side, so nothing here can change a run.
 */
export type AnalyticsEvent =
  | { name: 'run_start'; stage: string; character: string; curse: number }
  | { name: 'run_end'; stage: string; character: string; timeSec: number; level: number; kills: number; cause: string; curse: number }
  | { name: 'levelup_pick'; kind: string; id: string }
  | { name: 'chest_open'; grade: string; rewards: number }
  | { name: 'ad_shown'; kind: string; earned: boolean }
  | { name: 'purchase'; id: string; ok: boolean }
  | { name: 'tutorial_done' };

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
