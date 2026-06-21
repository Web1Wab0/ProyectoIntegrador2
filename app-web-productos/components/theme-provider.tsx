"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(preference: ThemePreference) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    "light"
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("ahorrape-theme");
    const initial: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(nextPreference: ThemePreference) {
      const nextResolved = resolveTheme(nextPreference);
      document.documentElement.dataset.theme = nextResolved;
      document.documentElement.style.colorScheme = nextResolved;
      setResolvedTheme(nextResolved);
      window.dispatchEvent(
        new CustomEvent("ahorrape-theme-change", {
          detail: { theme: nextResolved },
        })
      );
    }

    const initialTimer = window.setTimeout(() => {
      setPreferenceState(initial);
      apply(initial);
    }, 0);

    function handleSystemChange() {
      if (
        (window.localStorage.getItem("ahorrape-theme") ?? "system") ===
        "system"
      ) {
        apply("system");
      }
    }

    media.addEventListener("change", handleSystemChange);
    return () => {
      window.clearTimeout(initialTimer);
      media.removeEventListener("change", handleSystemChange);
    };
  }, []);

  function setPreference(nextPreference: ThemePreference) {
    window.localStorage.setItem("ahorrape-theme", nextPreference);
    setPreferenceState(nextPreference);
    const nextResolved = resolveTheme(nextPreference);
    document.documentElement.dataset.theme = nextResolved;
    document.documentElement.style.colorScheme = nextResolved;
    setResolvedTheme(nextResolved);
    window.dispatchEvent(
      new CustomEvent("ahorrape-theme-change", {
        detail: { theme: nextResolved },
      })
    );
  }

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme debe usarse dentro de ThemeProvider.");
  return value;
}
