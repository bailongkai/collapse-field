import { Capacitor } from '@capacitor/core';
import { webAds, nativeAds, type AdsService } from './ads';
import { webPurchases, nativePurchases, type PurchasesService } from './purchases';
import { analytics } from './analytics';

export { analytics } from './analytics';
export type { AdsService, RewardKind } from './ads';
export type { PurchasesService, ProductId } from './purchases';

/** Keys the stores hand out; the sample AdMob ids serve until real ones exist. */
const ADMOB_REWARDED = 'ca-app-pub-3940256099942544/5224354917';
const ADMOB_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';
const REVENUECAT_KEY = import.meta.env.VITE_REVENUECAT_KEY ?? '';

export interface Platform {
  native: boolean;
  ads: AdsService;
  purchases: PurchasesService;
}

let platform: Platform | null = null;

/** Built once at startup. The web fakes are what the browser suite exercises. */
export function initPlatform(o: { testMode: boolean; debug: boolean; fakeAds?: boolean }): Platform {
  const native = Capacitor.isNativePlatform();
  analytics.configure({ debug: o.debug });
  platform = {
    native,
    ads: native ? nativeAds({ testMode: o.testMode, rewardedId: ADMOB_REWARDED, interstitialId: ADMOB_INTERSTITIAL }) : webAds({ testMode: o.testMode, fakeAds: o.fakeAds, rewardedId: '', interstitialId: '' }),
    purchases: native ? nativePurchases(REVENUECAT_KEY) : webPurchases(o.testMode),
  };
  return platform;
}

export function getPlatform(): Platform {
  if (!platform) throw new Error('initPlatform() has not been called');
  return platform;
}
