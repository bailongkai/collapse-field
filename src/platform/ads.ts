/**
 * Rewarded and interstitial ads behind one interface. The web build ships a fake that resolves
 * after a short pause (at once under test), so every flow that depends on an ad can be exercised
 * by the browser suite; the native build loads AdMob lazily and only there.
 */
import type * as AdMobNs from '@capacitor-community/admob';

export type RewardKind = 'revive' | 'doubleGold';

export interface AdsService {
  /** whether a rewarded ad could be offered at all */
  available(): boolean;
  /** shows a rewarded ad; resolves true only if the reward was earned */
  showRewarded(kind: RewardKind): Promise<boolean>;
  /** shows an interstitial if one is loaded; never throws */
  showInterstitial(): Promise<void>;
}

export interface AdsConfig {
  testMode: boolean;
  /** the web fake only answers when a test asks for it (?ads=1); a plain web build has no ads */
  fakeAds?: boolean;
  /** AdMob unit ids; the sample ids until real ones exist */
  rewardedId: string;
  interstitialId: string;
}

export function webAds(cfg: AdsConfig): AdsService {
  return {
    available: () => cfg.testMode && cfg.fakeAds === true,
    showRewarded: async () => {
      await new Promise((r) => setTimeout(r, cfg.testMode ? 0 : 1200));
      return true;
    },
    showInterstitial: async () => {
      await new Promise((r) => setTimeout(r, cfg.testMode ? 0 : 600));
    },
  };
}

export function nativeAds(cfg: AdsConfig): AdsService {
  let ready: Promise<typeof AdMobNs> | null = null;
  const mod = () => (ready ??= import('@capacitor-community/admob').then(async (m) => {
    // the stores require the tracking prompt on iOS and the GDPR consent form where it applies,
    // both before the first ad; neither failing may stop the game from starting
    try {
      await m.AdMob.requestTrackingAuthorization();
    } catch {
      /* not iOS, or already answered */
    }
    try {
      const info = await m.AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === m.AdmobConsentStatus.REQUIRED) await m.AdMob.showConsentForm();
    } catch (error) {
      console.warn('consent flow failed', error);
    }
    await m.AdMob.initialize({ initializeForTesting: cfg.testMode });
    return m;
  }));
  return {
    available: () => true,
    showRewarded: async (kind) => {
      try {
        const m = await mod();
        let earned = false;
        const sub = await m.AdMob.addListener(m.RewardAdPluginEvents.Rewarded, () => {
          earned = true;
        });
        await m.AdMob.prepareRewardVideoAd({ adId: cfg.rewardedId, isTesting: cfg.testMode });
        await m.AdMob.showRewardVideoAd();
        sub.remove();
        void kind;
        return earned;
      } catch (error) {
        console.warn('rewarded ad failed', error);
        return false;
      }
    },
    showInterstitial: async () => {
      try {
        const m = await mod();
        await m.AdMob.prepareInterstitial({ adId: cfg.interstitialId, isTesting: cfg.testMode });
        await m.AdMob.showInterstitial();
      } catch (error) {
        console.warn('interstitial failed', error);
      }
    },
  };
}
