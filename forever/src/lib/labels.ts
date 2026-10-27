import type { CombatRole, Database, GuildRole } from "./database.types";

export const GUILD_ROLE_LABELS: Record<GuildRole, string> = {
  member: "Członek gildii",
  officer: "Oficer",
  admin: "Administrator",
};

export const COMBAT_ROLE_LABELS: Record<CombatRole, string> = {
  tank: "Obrońca",
  healer: "Uzdrowiciel",
  dps: "Zadający obrażenia",
};

export const EVENT_TYPE_LABELS: Record<Database["public"]["Enums"]["event_type"], string> = {
  pvp: "Walka z graczami",
  battleground: "Pole bitwy",
  raid: "Rajd",
  other: "Inne",
};

export const EVENT_STATUS_LABELS: Record<Database["public"]["Enums"]["event_status"], string> = {
  scheduled: "Zaplanowane",
  cancelled: "Odwołane",
  completed: "Zakończone",
};

export const LFG_ACTIVITY_LABELS: Record<Database["public"]["Enums"]["lfg_activity"], string> = {
  arena: "Arena",
  battleground: "Pole bitwy",
  mythic_plus: "Loch mityczny+",
  raid: "Rajd",
  other: "Inne",
};

export const LFG_STATUS_LABELS: Record<Database["public"]["Enums"]["lfg_status"], string> = {
  open: "Otwarta",
  filled: "Kompletna",
  closed: "Zamknięta",
};
