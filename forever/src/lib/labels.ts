import type { CombatRole, GuildRole } from "./database.types";

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

export const EVENT_TYPE_LABELS: Record<"pvp" | "battleground" | "raid" | "other", string> = {
  pvp: "Walka z graczami",
  battleground: "Pole bitwy",
  raid: "Rajd",
  other: "Inne",
};

export const EVENT_STATUS_LABELS: Record<"scheduled" | "cancelled" | "completed", string> = {
  scheduled: "Zaplanowane",
  cancelled: "Odwołane",
  completed: "Zakończone",
};

export const LFG_ACTIVITY_LABELS: Record<"arena" | "battleground" | "mythic_plus" | "raid" | "other", string> = {
  arena: "Arena",
  battleground: "Pole bitwy",
  mythic_plus: "Loch mityczny+",
  raid: "Rajd",
  other: "Inne",
};

export const LFG_STATUS_LABELS: Record<"open" | "filled" | "closed", string> = {
  open: "Otwarta",
  filled: "Kompletna",
  closed: "Zamknięta",
};
