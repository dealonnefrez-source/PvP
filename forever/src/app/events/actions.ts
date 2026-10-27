"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMemberContext } from "@/lib/auth";
import { getEventContext } from "@/lib/event-data";
import { createWritableClient } from "@/lib/supabase/server";
import { eventSchema, rsvpSchema, formatEventTime } from "@/lib/events";
import { notifyDiscord } from "@/lib/discord";

export type EventFormState = {
  error?: string;
  success?: string;
  warning?: string;
  eventId?: string;
};

function refreshEvent(id: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
}

export async function createEvent(_previous: EventFormState, formData: FormData): Promise<EventFormState> {
  const { user } = await getMemberContext();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (Date.parse(parsed.data.starts_at) <= Date.now()) return { error: "Wydarzenie musi zaczynać się w przyszłości." };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("Event creation configuration missing: NEXT_PUBLIC_SITE_URL");
    return { error: "Brakuje adresu strony w konfiguracji. Skontaktuj się z administratorem." };
  }
  const supabase = await createWritableClient();
  const { data, error } = await supabase.from("events").insert({ ...parsed.data, created_by: user.id }).select("id").single();
  if (error) {
    console.error("Event creation failed", { code: error.code });
    return { error: "Nie udało się utworzyć wydarzenia. Sprawdź termin i uprawnienia, a następnie spróbuj ponownie." };
  }
  let warning: string | undefined;
  try {
    await notifyDiscord({
      kind: "event", title: parsed.data.title,
      description: `${formatEventTime(parsed.data.starts_at)} (Europe/Warsaw)\n${parsed.data.description}`,
      url: new URL(`/events/${data.id}`, siteUrl).toString(),
    });
  } catch {
    // Never log the fetch error: it may contain a webhook URL/token.
    console.error("Event saved, but Discord notification failed", { eventId: data.id });
    warning = "Wydarzenie zostało zapisane, ale powiadomienie na Discordzie nie zostało dostarczone. Nie twórz wydarzenia ponownie.";
  }
  refreshEvent(data.id);
  return { success: "Wydarzenie zostało zaplanowane.", eventId: data.id, warning };
}

export async function saveRsvp(_previous: EventFormState, formData: FormData): Promise<EventFormState> {
  await getMemberContext();
  const parsed = rsvpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createWritableClient();
  const { error } = await supabase.rpc("save_event_rsvp", {
    p_event_id: parsed.data.event_id, p_role: parsed.data.role,
  });
  if (error) {
    console.error("RSVP save failed", { code: error.code });
    return { error: error.code === "23514" ? "Zapisy są zamknięte: wydarzenie już się rozpoczęło lub zostało odwołane." : "Nie udało się zapisać udziału. Odśwież stronę i spróbuj ponownie." };
  }
  refreshEvent(parsed.data.event_id);
  return { success: "Twój udział i rola zostały zapisane." };
}

export async function withdrawRsvp(_previous: EventFormState, formData: FormData): Promise<EventFormState> {
  const { user } = await getMemberContext();
  const id = z.uuid().safeParse(formData.get("event_id"));
  if (!id.success) return { error: "Nieprawidłowe wydarzenie." };
  const supabase = await createWritableClient();
  const { error } = await supabase.from("event_rsvps").delete().eq("event_id", id.data).eq("profile_id", user.id);
  if (error) {
    console.error("RSVP withdrawal failed", { code: error.code });
    return { error: "Nie udało się wycofać udziału. Spróbuj ponownie." };
  }
  refreshEvent(id.data);
  return { success: "Twój udział został wycofany." };
}

export async function cancelEvent(_previous: EventFormState, formData: FormData): Promise<EventFormState> {
  const { isOfficer, user, supabase: reader } = await getEventContext();
  const id = z.uuid().safeParse(formData.get("event_id"));
  if (!id.success) return { error: "Nieprawidłowe wydarzenie." };
  const { data: event, error: readError } = await reader.from("events").select("created_by").eq("id", id.data).maybeSingle();
  if (readError) {
    console.error("Event cancellation permission query failed", { code: readError.code });
    return { error: "Nie udało się sprawdzić organizatora wydarzenia." };
  }
  if (!event || (!isOfficer && event.created_by !== user.id)) return { error: "Możesz odwołać własne wydarzenie. Cudzymi zarządza oficer lub mistrz gildii." };
  const supabase = await createWritableClient();
  const { error } = await supabase.from("events").update({ status: "cancelled" })
    .eq("id", id.data).eq("status", "scheduled").select("id").single();
  if (error) {
    console.error("Event cancellation failed", { code: error.code });
    return { error: "Nie udało się odwołać wydarzenia. Odśwież stronę i sprawdź jego stan." };
  }
  refreshEvent(id.data);
  return { success: "Wydarzenie zostało odwołane. Lista zapisów została zachowana." };
}
