export type OnlineAudioCachePolicy = "provider" | "none";

export const ONLINE_AUDIO_CACHE_POLICY_STORAGE_KEY = "tiaolv-online-audio-cache-policy";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readOnlineAudioCachePolicy(storage: StorageLike): OnlineAudioCachePolicy {
  return storage.getItem(ONLINE_AUDIO_CACHE_POLICY_STORAGE_KEY) === "none" ? "none" : "provider";
}

export function writeOnlineAudioCachePolicy(policy: OnlineAudioCachePolicy, storage: StorageLike) {
  storage.setItem(ONLINE_AUDIO_CACHE_POLICY_STORAGE_KEY, policy);
}

export function applyOnlineAudioCachePolicy(
  url: string,
  policy: OnlineAudioCachePolicy,
  nonce: number = Date.now()
) {
  if (policy === "provider") return url;
  const parsed = new URL(url);
  parsed.searchParams.set("cachePolicy", "none");
  parsed.searchParams.set("cacheNonce", String(nonce));
  return parsed.toString();
}
