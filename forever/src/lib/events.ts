import { z } from "./validation";
import type { CombatRole, GuildEvent } from "./database.types";
export { COMBAT_ROLE_LABELS as RSVP_ROLE_LABELS, EVENT_TYPE_LABELS as EVENT_KINDS } from "./labels";

export const COMBAT_ROLES = ["tank", "healer", "dps"] as const;
const slots = z.coerce.number().int("Podaj całkowitą liczbę miejsc.").min(0, "Liczba miejsc nie może być ujemna.").max(80, "Maksymalnie 80 miejsc.");
export const eventSchema = z.object({
  title: z.string().trim().min(3, "Tytuł musi mieć co najmniej 3 znaki.").max(120, "Tytuł może mieć maksymalnie 120 znaków."),
  description: z.string().trim().max(4000, "Opis może mieć maksymalnie 4000 znaków."),
  event_type: z.enum(["battleground", "pvp", "raid", "other"], { error: "Wybierz rodzaj wydarzenia." }),
  starts_at: z.iso.datetime({ offset: true, error: "Podaj prawidłowy termin rozpoczęcia." }),
  ends_at: z.iso.datetime({ offset: true, error: "Podaj prawidłowy termin zakończenia." }),
  tanks_needed: slots,
  healers_needed: slots,
  dps_needed: slots,
}).refine((value) => Date.parse(value.ends_at) > Date.parse(value.starts_at), {
  message: "Zakończenie musi być późniejsze niż rozpoczęcie.",
}).refine((value) => {
  const total = value.tanks_needed + value.healers_needed + value.dps_needed;
  return total > 0 && total <= 80;
}, { message: "Zaplanuj od 1 do 80 miejsc łącznie." });

export const rsvpSchema = z.object({
  event_id: z.uuid("Nieprawidłowe wydarzenie."),
  role: z.enum(COMBAT_ROLES, { error: "Wybierz rolę na to wydarzenie." }),
});

export function roleTarget(event: Pick<GuildEvent, "tanks_needed" | "healers_needed" | "dps_needed">, role: CombatRole) {
  return role === "tank" ? event.tanks_needed : role === "healer" ? event.healers_needed : event.dps_needed;
}

export function roleSummary(target: number, signedUp: number) {
  return { missing: Math.max(0, target - signedUp), extra: Math.max(0, signedUp - target) };
}

export function canSignUp(event: Pick<GuildEvent, "status" | "starts_at">, now: number) {
  return event.status === "scheduled" && Date.parse(event.starts_at) > now;
}

export const GUILD_TIME_ZONE = "Europe/Warsaw";
export function guildDateKey(instant: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GUILD_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatEventTime(instant: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: GUILD_TIME_ZONE, day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(instant));
}

// datetime-local uses the browser's timezone; reject normalized nonexistent DST times.
export function localDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Podaj datę i godzinę.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Nieprawidłowa data i godzina.");
  const pad = (number: number) => String(number).padStart(2, "0");
  const roundTrip = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (roundTrip !== value) throw new Error("Ta godzina nie istnieje w twojej strefie czasowej. Wybierz inny termin.");
  return date.toISOString();
}

export function calendarMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000 || Number(month.slice(0, 4)) > 2100) {
    throw new Error("Nieprawidłowy miesiąc kalendarza.");
  }
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - (first.getUTCDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const shift = (delta: number) => new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
  return {
    days, previous: shift(-1), next: shift(1),
    label: new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }).format(first),
    // Widen the query beyond the Warsaw calendar grid to include timezone boundaries.
    from: new Date(gridStart.getTime() - 86400000).toISOString(),
    to: new Date(gridStart.getTime() + 43 * 86400000).toISOString(),
  };
}
