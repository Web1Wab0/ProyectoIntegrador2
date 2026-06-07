import type { UserRole } from "./profile";

export function getSafeInternalPath(nextUrl: string | null, fallback = "/") {
  if (!nextUrl || !nextUrl.startsWith("/") || nextUrl.startsWith("//")) {
    return fallback;
  }

  if (nextUrl.includes("\\")) {
    return fallback;
  }

  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsedUrl = new URL(nextUrl, origin);

    if (parsedUrl.origin !== origin) {
      return fallback;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return fallback;
  }
}

export function getDefaultPathForRole(role: UserRole | null, nextPath = "/") {
  if (role === "merchant") return "/dashboard";
  if (role === "customer") return nextPath;
  if (role === "admin") return "/dashboard";

  return "/auth/complete-profile";
}
