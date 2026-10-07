export const ONBOARDING_STORAGE_KEY = "tiaolv-music-onboarding-version";
export const ONBOARDING_VERSION = 1;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function hasCompletedOnboarding(storage: StorageLike): boolean {
  return storage.getItem(ONBOARDING_STORAGE_KEY) !== null;
}

export function markOnboardingCompleted(storage: StorageLike): void {
  storage.setItem(ONBOARDING_STORAGE_KEY, String(ONBOARDING_VERSION));
}
