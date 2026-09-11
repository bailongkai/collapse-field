/**
 * In-app purchases behind one interface. Product ids are the contract with the stores; the web
 * fake completes at once so the shop flow is testable, and the native build goes through RevenueCat.
 */
import type * as RevenueCatNs from '@revenuecat/purchases-capacitor';
import { PRODUCT_IDS, type ProductId } from '../core/save/purchases';

export type { ProductId };
export { PRODUCT_IDS };

export interface Product {
  id: ProductId;
  /** a display price, already localised by the store; the fake shows a placeholder */
  price: string;
}

export interface PurchasesService {
  available(): boolean;
  products(): Promise<Product[]>;
  /** resolves true when the purchase completed */
  buy(id: ProductId): Promise<boolean>;
  /** ids the store says this account owns (non-consumables) */
  restore(): Promise<ProductId[]>;
}

export function webPurchases(testMode: boolean): PurchasesService {
  return {
    available: () => testMode, // there is no store on the web; the fake exists for the tests
    products: async () => PRODUCT_IDS.map((id) => ({ id, price: '¥—' })),
    buy: async () => true,
    restore: async () => [],
  };
}

export function nativePurchases(apiKey: string): PurchasesService {
  let ready: Promise<typeof RevenueCatNs> | null = null;
  const mod = () => (ready ??= import('@revenuecat/purchases-capacitor').then(async (m) => {
    await m.Purchases.configure({ apiKey });
    return m;
  }));
  return {
    available: () => true,
    products: async () => {
      try {
        const m = await mod();
        const { products } = await m.Purchases.getProducts({ productIdentifiers: [...PRODUCT_IDS] });
        return products.map((p) => ({ id: p.identifier as ProductId, price: p.priceString }));
      } catch (error) {
        console.warn('products failed', error);
        return [];
      }
    },
    buy: async (id) => {
      try {
        const m = await mod();
        const { products } = await m.Purchases.getProducts({ productIdentifiers: [id] });
        if (!products[0]) return false;
        await m.Purchases.purchaseStoreProduct({ product: products[0] });
        return true;
      } catch (error) {
        console.warn('purchase failed', error);
        return false;
      }
    },
    restore: async () => {
      try {
        const m = await mod();
        const { customerInfo } = await m.Purchases.restorePurchases();
        return Object.keys(customerInfo.entitlements.active) as ProductId[];
      } catch (error) {
        console.warn('restore failed', error);
        return [];
      }
    },
  };
}
