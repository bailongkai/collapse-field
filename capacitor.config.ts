import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native shells. `npm run cap:sync` builds the web bundle and copies it into ios/ and
 * android/, which are generated locally with `npx cap add ios` / `npx cap add android` and not
 * committed. See README "打包手机版".
 */
const config: CapacitorConfig = {
  appId: 'com.bailongkai.collapsefield',
  appName: 'Collapse Field',
  webDir: 'dist',
  backgroundColor: '#05070c',
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#05070c' },
  },
};

export default config;
