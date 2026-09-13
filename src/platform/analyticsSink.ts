import { Capacitor } from '@capacitor/core';
import type { AnalyticsEvent, AnalyticsSink } from './analytics';

/**
 * Where the events go. PostHog on both the web and the device: the Capacitor plugin bridges the
 * real native SDKs, so queueing, sessions and the iOS privacy manifest are the vendor's problem
 * rather than ours, and the browser build uses posthog-js at the same project.
 *
 * Everything is loaded lazily and everything fails soft. A game that cannot start because its
 * analytics endpoint is unreachable is a far worse bug than a week of missing data, so nothing
 * here is awaited on the path to the first frame and every failure is a warning.
 */
const KEY = import.meta.env.VITE_POSTHOG_KEY ?? '';
const HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let failures = 0;
let sent = 0;

/** What the debug hook reports, so a silently dead sink is visible rather than assumed healthy. */
export function sinkStats(): { sent: number; failures: number; enabled: boolean } {
  return { sent, failures, enabled: KEY !== '' };
}

/** The properties of one event, minus its name, which PostHog takes separately. */
function props(e: AnalyticsEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) if (k !== 'name') out[k] = v;
  return out;
}

function nativeSink(): AnalyticsSink {
  let ready: Promise<{ capture(o: { event: string; properties?: Record<string, unknown> }): Promise<void> } | null> | null = null;
  const load = () =>
    (ready ??= import('@capawesome/capacitor-posthog')
      .then(async (m) => {
        await m.Posthog.setup({ apiKey: KEY, host: HOST });
        return m.Posthog;
      })
      .catch((error) => {
        console.warn('posthog setup failed', error);
        return null;
      }));
  return (e) => {
    void load().then((ph) => {
      if (!ph) {
        failures++;
        return;
      }
      ph.capture({ event: e.name, properties: props(e) })
        .then(() => {
          sent++;
        })
        .catch(() => {
          failures++;
        });
    });
  };
}

function webSink(): AnalyticsSink {
  let ready: Promise<{ capture(name: string, p?: Record<string, unknown>): void } | null> | null = null;
  const load = () =>
    (ready ??= import('posthog-js')
      .then((m) => {
        // anonymous by construction: no identify() call anywhere, so there is no person profile to
        // declare, nothing to reconcile with an advertising id, and the cheap event rate applies
        m.default.init(KEY, { api_host: HOST, person_profiles: 'identified_only', capture_pageview: false, autocapture: false });
        return m.default;
      })
      .catch((error) => {
        console.warn('posthog-js failed to load', error);
        return null;
      }));
  return (e) => {
    void load().then((ph) => {
      if (!ph) {
        failures++;
        return;
      }
      try {
        ph.capture(e.name, props(e));
        sent++;
      } catch {
        failures++;
      }
    });
  };
}

/**
 * The sink for this build, or null when there is nothing to send to. It is null under `?test=1`
 * and null when no key is configured, which is what keeps the browser suite and every local run
 * from reporting anything at all.
 */
export function buildSink(testMode: boolean): AnalyticsSink | null {
  if (testMode || KEY === '') return null;
  return Capacitor.isNativePlatform() ? nativeSink() : webSink();
}
