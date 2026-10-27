import type { GuildRole } from "./database.types";

export const GUILD_ROLES = ["member", "officer", "guild_master"] as const;
export function isGuildOfficer(role: GuildRole | null | undefined) {
  return role === "officer" || role === "guild_master";
}
