import type { AnalyticsSink } from './analytics';

/**
 * Where the events go: PostHog's public capture endpoint, posted directly.
 *
 * The obvious alternative was posthog-js, and it was tried first. It fetches a remote config on
 * startup and pulls down session replay, surveys, dead-click capture and web vitals on the
 * strength of it — four extra scripts to load a game with, and a replay quota spent recording a
 * canvas that plays back as a blank rectangle — and the client-side switches for those are
 * advisory. The capture endpoint itself needs no SDK: it is one POST of JSON, authenticated by the
 * public project key, and the same URL works from a browser and from a Capacitor WebView. What is
 * given up is offline queueing across an app kill, which for a game is a handful of events.
 *
 * Everything here fails soft. A game that will not start because its analytics endpoint is down is
 * a far worse bug than a week of missing data, so nothing is awaited on the way to the first frame
 * and every failure is a counter rather than a throw.
 *
 * The key, host and the verdict on the key are decided in `vite.config.ts` and substituted in as
 * literals. Deliberately NOT `import.meta.env.VITE_POSTHOG_KEY`: Vite inlines that as written, so
 * reading it here would put whatever is in the environment into a bundle served from a public
 * page. Only a `phc_` project key ever reaches this file.
 */
declare const __POSTHOG_KEY__: string;
declare const __POSTHOG_HOST__: string;
declare const __POSTHOG_KEY_REJECTED__: boolean;

const KEY = typeof __POSTHOG_KEY__ === 'string' ? __POSTHOG_KEY__ : '';
const HOST = (typeof __POSTHOG_HOST__ === 'string' ? __POSTHOG_HOST__ : 'https://us.i.posthog.com').replace(/\/$/, '');
const REJECTED = typeof __POSTHOG_KEY_REJECTED__ === 'boolean' ? __POSTHOG_KEY_REJECTED__ : false;
if (REJECTED) {
  console.error(
    'VITE_POSTHOG_KEY is not a project API key, so analytics is off and the value was kept out of ' +
      'this bundle. Use the key beginning phc_ from PostHog > Settings > Project > Project API key.',
  );
}

/** How long events wait to travel together, and how many force an early send. */
const FLUSH_MS = 4000;
const MAX_BATCH = 20;
const DEVICE_KEY = 'xjxcz.did';

let failures = 0;
let sent = 0;
let queued = 0;
/**
 * Whether this build is really sending. Not "is a key configured": a developer with a key in their
 * environment still runs the browser suite under `?test=1`, and a health report that said "on"
 * there would be answering a different question from the one being asked.
 */
let live = false;

/** What the debug hook reports, so a silently dead sink is visible rather than assumed healthy. */
export function sinkStats(): { sent: number; failures: number; queued: number; enabled: boolean; keyRejected: boolean } {
  return { sent, failures, queued, enabled: live, keyRejected: REJECTED };
}

/**
 * A stable anonymous id for this device. It is a random value in local storage and nothing else —
 * no advertising identifier, no fingerprint — which is what keeps retention computable while
 * leaving nothing to declare beyond "app activity".
 */
function deviceId(): string {
  try {
    const held = localStorage.getItem(DEVICE_KEY);
    if (held) return held;
    const made = `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    // private mode, or a WebView with storage off: a per-session id still gives session metrics
    return `s_${Math.random().toString(36).slice(2)}`;
  }
}

interface Batched {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export function posthogSink(): AnalyticsSink {
  const distinctId = deviceId();
  const pending: Batched[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const send = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    queued = pending.length;
    void fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, batch }),
      // survives the page going away, which is exactly when the last run_end is queued
      keepalive: true,
    })
      .then((r) => {
        if (r.ok) sent += batch.length;
        else failures += batch.length;
      })
      .catch(() => {
        failures += batch.length;
      });
  };

  if (typeof document !== 'undefined') {
    // the last events of a session are the ones that say how it ended; do not lose them to a tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') send();
    });
  }

  return (e) => {
    const properties: Record<string, unknown> = { distinct_id: distinctId, $lib: 'collapse-field' };
    for (const [k, v] of Object.entries(e)) if (k !== 'name') properties[k] = v;
    pending.push({ event: e.name, properties, timestamp: new Date().toISOString() });
    queued = pending.length;
    if (pending.length >= MAX_BATCH) send();
    else if (!timer) timer = setTimeout(send, FLUSH_MS);
  };
}

/**
 * The sink for this build, or null when there is nothing to send to. It is null under `?test=1`
 * and null when no key is configured, which is what keeps the browser suite and every local run
 * from reporting anything at all.
 */
export function buildSink(testMode: boolean): AnalyticsSink | null {
  if (testMode || KEY === '') return null;
  live = true;
  return posthogSink();
}
