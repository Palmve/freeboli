import { createClient } from "@/lib/supabase/server";

const cache = new Map<string, { value: unknown; ts: number }>();
const CACHE_TTL = 60_000; // 1 min cache

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.value as T;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .single();
    if (data?.value != null) {
      const val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      cache.set(key, { value: val, ts: Date.now() });
      return val as T;
    }
  } catch {
    // DB unavailable, use fallback
  }
  return fallback;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_settings").select("key, value");
    const result: Record<string, unknown> = {};
    for (const row of data ?? []) {
      let val = row.value;
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { /* keep as-is */ }
      }
      result[row.key] = val;
      cache.set(row.key, { value: val, ts: Date.now() });
    }
    return result;
  } catch {
    return {};
  }
}

export function clearSettingsCache() {
  cache.clear();
}
