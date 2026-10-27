import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const getMemberContext = cache(async () => {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    console.error("Unable to validate user", { code: error.code, status: error.status });
    throw new Error("Nie udało się zweryfikować sesji. Spróbuj ponownie.");
  }
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?notice=verify-email");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id, guild_role, character_name, realm, race, character_class, primary_professions, last_active_at, created_at, updated_at")
    .eq("id", user.id).single();
  if (profileError) {
    console.error("Unable to load member profile", { code: profileError.code });
    throw new Error("Nie udało się wczytać profilu. Sprawdź, czy migracja bazy danych została zastosowana.");
  }
  return { supabase, user, profile };
});
