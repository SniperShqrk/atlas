import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

/**
 * The entitlement identifier as configured in the RevenueCat dashboard
 * (Entitlements → identifier). Everything downstream keys off this one
 * string, so if it's ever renamed in the dashboard it only needs to change
 * here.
 */
export const PRO_ENTITLEMENT_ID = 'pro';

// react-native-purchases is a native module — it does nothing useful in
// Expo Go and needs a custom dev client / real build to actually talk to
// StoreKit. Just as importantly, we don't want every dev machine that
// clones this repo to need real RevenueCat keys to run the app at all: with
// no key set, `configured` stays false and the rest of the app falls back
// to the local `setPro()` toggle in entitlements.ts exactly as it always
// has, so testing the rest of ATLAS never depends on this being wired up.
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

let configured = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

/** Call once, at app startup, before anything else in this file is used. */
export function configurePurchases(): boolean {
  const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
  if (!apiKey) {
    configured = false;
    return false;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

/** The current offering's packages, or null if unconfigured / offline / nothing set up in the dashboard yet. */
export async function fetchOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export type PurchaseOutcome =
  | { status: 'purchased'; customerInfo: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { status: 'purchased', customerInfo };
  } catch (e: any) {
    if (e?.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: e?.message ?? 'Purchase failed' };
  }
}

export type RestoreOutcome =
  | { status: 'restored'; customerInfo: CustomerInfo }
  | { status: 'nothing_to_restore' }
  | { status: 'error'; message: string };

export async function restore(): Promise<RestoreOutcome> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    if (isEntitled(customerInfo)) return { status: 'restored', customerInfo };
    return { status: 'nothing_to_restore' };
  } catch (e: any) {
    return { status: 'error', message: e?.message ?? 'Restore failed' };
  }
}

export function isEntitled(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** Keeps entitlement state live — catches renewals, cancellations, and
 *  refunds that happen outside the Paywall screen (e.g. Apple revoking
 *  access after a chargeback). Returns an unsubscribe function. */
export function subscribeToCustomerInfoUpdates(
  onUpdate: (customerInfo: CustomerInfo) => void
): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(onUpdate);
  return () => Purchases.removeCustomerInfoUpdateListener(onUpdate);
}
