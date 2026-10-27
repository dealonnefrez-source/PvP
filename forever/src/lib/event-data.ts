import "server-only";

import { getMemberContext } from "./auth";

export async function getEventContext() {
  const context = await getMemberContext();
  const { data: isOfficer, error } = await context.supabase.rpc("is_guild_officer");
  if (error) {
    console.error("Officer permission query failed", { code: error.code });
    throw new Error("Nie udało się sprawdzić uprawnień. Sprawdź, czy migracja 003 została uruchomiona.");
  }
  return { ...context, isOfficer, fetchedAt: Date.now() };
}
