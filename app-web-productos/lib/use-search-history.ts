"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "ahorrape-search-history";
const MAX_HISTORY_ITEMS = 5;

function readHistory() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(() => readHistory());

  const addSearch = useCallback((term: string) => {
    const normalized = term.trim();
    if (!normalized) return;

    setHistory((current) => {
      const next = [
        normalized,
        ...current.filter(
          (item) => item.toLowerCase() !== normalized.toLowerCase()
        ),
      ].slice(0, MAX_HISTORY_ITEMS);

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, addSearch };
}
