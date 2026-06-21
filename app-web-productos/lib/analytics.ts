"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const SESSION_KEY = "ahorrape-analytics-session";
const OPT_OUT_KEY = "ahorrape-analytics-opt-out";

export function setAnalyticsOptOut(value: boolean) {
  window.localStorage.setItem(OPT_OUT_KEY, value ? "1" : "0");
}

export function getAnalyticsOptOut() {
  return window.localStorage.getItem(OPT_OUT_KEY) === "1";
}

function getSessionHash() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, value);
  return value;
}

export async function recordStoreEvent(
  supabase: SupabaseClient,
  input: {
    eventType: "store_view" | "product_view" | "favorite_store" | "favorite_product";
    storeId: string;
    storeProductId?: string | null;
  }
) {
  if (getAnalyticsOptOut()) return;

  await supabase.rpc("record_store_event", {
    p_session_hash: getSessionHash(),
    p_event_type: input.eventType,
    p_store_id: input.storeId,
    p_store_product_id: input.storeProductId ?? null,
  });
}
