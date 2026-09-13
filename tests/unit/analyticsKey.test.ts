import { describe, it, expect } from 'vitest';

/**
 * The rule the sink enforces, tested on its own. PostHog's three key kinds look alike and only one
 * of them may be built into a bundle served from a public page, so this is a credential-leak guard
 * rather than a configuration nicety.
 */
const accepted = (key: string): boolean => key.startsWith('phc_');

describe('which PostHog key may be built into the client', () => {
  it('accepts a project API key', () => {
    expect(accepted('phc_aVeryLongProjectKeyValue0123456789')).toBe(true);
  });

  it('refuses the two secret kinds, which would be readable by anyone who opened the bundle', () => {
    expect(accepted('phx_personalApiKeyValue0123456789'), 'a personal API key was accepted').toBe(false);
    expect(accepted('phs_projectSecretKeyValue0123456789'), 'a project secret key was accepted').toBe(false);
  });

  it('refuses anything else, including an empty or half-pasted value', () => {
    for (const bad of ['', ' ', 'phc', 'PHC_upper', 'sk-something', 'your-key-here']) {
      expect(accepted(bad), `accepted ${JSON.stringify(bad)}`).toBe(false);
    }
  });
});
