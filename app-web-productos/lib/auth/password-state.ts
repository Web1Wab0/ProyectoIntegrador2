import type { User } from "@supabase/supabase-js";

export function hasPasswordSet(user: User | null | undefined) {
  const metadataValue = user?.user_metadata?.password_set;

  if (metadataValue === true || metadataValue === "true") {
    return true;
  }

  const appProvider = user?.app_metadata?.provider;
  const appProviders = user?.app_metadata?.providers;
  const hasEmailProvider =
    appProvider === "email" ||
    (Array.isArray(appProviders) && appProviders.includes("email"));
  const hasEmailIdentity =
    user?.identities?.some((identity) => identity.provider === "email") ?? false;

  return hasEmailProvider || hasEmailIdentity;
}
