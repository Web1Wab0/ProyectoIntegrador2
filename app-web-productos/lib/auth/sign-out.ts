import type { SupabaseClient } from "@supabase/supabase-js";

export async function signOutCurrentSession(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw error;
  }
}
