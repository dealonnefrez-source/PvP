import "server-only";

import { getMemberContext } from "./auth";
import { isGuildOfficer } from "./guild";
import type { GuildRole } from "./database.types";

export async function getEventContext() {
  const context = await getMemberContext();
  return { ...context, isOfficer: isGuildOfficer(context.profile.guild_role), fetchedAt: Date.now() };
}

export async function getEventAuthors(events: { created_by: string | null }[]) {
  const { supabase } = await getMemberContext();
  const ids = [...new Set(events.flatMap((event) => event.created_by ? [event.created_by] : []))];
  if (!ids.length) return new Map<string, { id: string; guild_role: GuildRole }>();
  const { data, error } = await supabase.from("profiles").select("id, guild_role").in("id", ids).limit(1000);
  if (error || data.length !== ids.length) {
    console.error("Event authors query failed or incomplete", { code: error?.code });
    throw new Error("Nie udało się wczytać ról organizatorów. Odśwież stronę.");
  }
  return new Map(data.map((profile) => [profile.id, profile]));
}
