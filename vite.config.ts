import { defineConfig, loadEnv } from 'vite';

/**
 * PostHog issues three kinds of key and only one of them may be built into this bundle. `phc_` is
 * the public, write-only project key the browser SDK is designed around; `phx_` (personal) and
 * `phs_` (project secret) authenticate against the private API.
 *
 * This check has to happen HERE rather than at runtime. Vite inlines `import.meta.env.VITE_*` as a
 * literal at build time, so a guard in application code stops the key being *used* while leaving
 * it sitting in a JavaScript file served from a public page. Filtering it into the `define` is the
 * only place that keeps a wrong key out of the artefact.
 */
function projectKey(raw: string): { key: string; rejected: boolean } {
  if (raw === '') return { key: '', rejected: false };
  if (raw.startsWith('phc_')) return { key: raw, rejected: false };
  console.warn(
    `\n  VITE_POSTHOG_KEY starts with "${raw.slice(0, 4)}", which is not a project API key.` +
      '\n  Analytics is disabled and the value has been kept out of the bundle.' +
      '\n  Use the phc_ key from PostHog > Settings > Project > Project API key.\n',
  );
  return { key: '', rejected: true };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const { key, rejected } = projectKey(env.VITE_POSTHOG_KEY ?? '');
  return {
    base: './',
    server: { port: 5173, strictPort: false },
    define: {
      __POSTHOG_KEY__: JSON.stringify(key),
      __POSTHOG_HOST__: JSON.stringify(env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'),
      __POSTHOG_KEY_REJECTED__: JSON.stringify(rejected),
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: { phaser: ['phaser'] },
        },
      },
    },
    optimizeDeps: { include: ['phaser'] },
  };
});
