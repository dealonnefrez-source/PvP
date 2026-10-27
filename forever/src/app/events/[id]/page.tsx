import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CancelEventForm, RsvpForm } from "@/components/rsvp-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventAuthors, getEventContext } from "@/lib/event-data";
import { isGuildOfficer } from "@/lib/guild";
import { canSignUp, COMBAT_ROLES, EVENT_KINDS, formatEventTime, roleSummary, roleTarget, RSVP_ROLE_LABELS } from "@/lib/events";
import { EVENT_STATUS_LABELS } from "@/lib/labels";
import { CLASS_LABELS } from "@/lib/wow";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, isOfficer, fetchedAt } = await getEventContext();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ data: event, error: eventError }, { data: rsvps, count, error: rsvpError }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("event_rsvps").select("*", { count: "exact" }).eq("event_id", id).order("created_at").limit(1000),
  ]);
  if (eventError || rsvpError || count === null || count > (rsvps?.length ?? 0)) {
    console.error("Event details query failed or was truncated", { code: eventError?.code ?? rsvpError?.code, count });
    throw new Error("Nie udało się wczytać wydarzenia lub pełnej listy uczestników.");
  }
  if (!event) notFound();
  const authors = await getEventAuthors([event]);
  const official = isGuildOfficer(event.created_by ? authors.get(event.created_by)?.guild_role : null);
  const hasTargets = event.tanks_needed + event.healers_needed + event.dps_needed > 0;
  const ids = rsvps.map((rsvp) => rsvp.profile_id);
  const { data: profiles, error: profilesError } = ids.length
    ? await supabase.from("profiles").select("id, character_name, realm, character_class").in("id", ids).limit(1000)
    : { data: [], error: null };
  if (profilesError) {
    console.error("Event participant profiles query failed", { code: profilesError.code });
    throw new Error("Nie udało się wczytać danych uczestników.");
  }
  if (profiles.length !== ids.length) {
    console.error("Event participant profiles incomplete", { eventId: id, expected: ids.length, received: profiles.length });
    throw new Error("Lista profili uczestników jest niepełna. Odśwież stronę, aby pobrać aktualny skład.");
  }
  const members = new Map(profiles.map((profile) => [profile.id, profile]));
  const currentRole = rsvps.find((rsvp) => rsvp.profile_id === user.id)?.role;
  const open = canSignUp(event, fetchedAt);
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <nav className="mb-8 flex flex-wrap gap-5 text-sm" aria-label="Nawigacja wydarzenia"><Link href="/events" className="text-primary underline">Wszystkie wydarzenia</Link><Link href="/dashboard" className="text-primary underline">Panel główny</Link><Link href="/profile" className="text-primary underline">Twój Profil</Link><Link href="/roster" className="text-primary underline">Członkowie</Link></nav>
      <div className="mb-4 flex flex-wrap gap-2"><Badge variant="outline">{EVENT_KINDS[event.event_type]}</Badge><Badge variant="secondary">{EVENT_STATUS_LABELS[event.status]}</Badge></div>
      {official && <Badge className="mb-4 border border-red-500 bg-red-950/20 text-red-300">Wydarzenie oficerskie</Badge>}
      <h1 className={`break-words text-3xl font-bold ${official ? "border-l-4 border-red-500 pl-4" : ""}`}>{event.title}</h1>
      <p className="mt-4 text-muted-foreground"><time dateTime={event.starts_at}>{formatEventTime(event.starts_at)}</time> — <time dateTime={event.ends_at}>{formatEventTime(event.ends_at)}</time></p>
      <p className="mt-1 text-xs text-muted-foreground">Czas polski — Europe/Warsaw</p>
      <p className="my-6 whitespace-pre-wrap break-words leading-relaxed">{event.description || "Organizator nie dodał opisu."}</p>
      <Card className="mb-8">
        <CardHeader><CardTitle>Twój udział</CardTitle><CardDescription>Jedna osoba, jeden zapis. Rolę możesz zmieniać do rozpoczęcia wydarzenia.</CardDescription></CardHeader>
        <CardContent><RsvpForm key={event.id} eventId={event.id} currentRole={currentRole} open={open} startsAt={event.starts_at} /></CardContent>
      </Card>
      <h2 className="mb-3 text-2xl font-semibold">Skład wydarzenia ({rsvps.length})</h2>
      <p className="mb-6 text-sm text-muted-foreground">Cele składu nie blokują zapisów. Nadwyżka jest oznaczona osobno, bez automatycznego przydzielania rezerwy. Odśwież stronę, aby zobaczyć najnowsze zapisy innych graczy.</p>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {COMBAT_ROLES.map((role) => {
          const participants = rsvps.filter((rsvp) => rsvp.role === role);
          const target = roleTarget(event, role);
          const { missing, extra } = roleSummary(target, participants.length);
          return (
            <Card key={role}>
              <CardHeader>
                <CardTitle>{RSVP_ROLE_LABELS[role]}</CardTitle>
                <CardDescription>Zapisani: {participants.length}{hasTargets ? ` / cel: ${target}` : " · bez ustalonego celu"}</CardDescription>
                <p className={`text-sm ${missing ? "text-primary" : "text-muted-foreground"}`}>
                  {!hasTargets ? "Otwarty skład" : missing ? `Brakuje: ${missing}` : target === 0 ? "Nie zaplanowano miejsc tej roli" : "Cel składu osiągnięty"}
                  {hasTargets && extra > 0 && ` · Nadwyżka: ${extra}`}
                </p>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? <p className="text-sm text-muted-foreground">Nikt jeszcze nie wybrał tej roli.</p> : (
                  <ul className="divide-y">
                    {participants.map((rsvp, index) => {
                      const member = members.get(rsvp.profile_id);
                      return <li key={rsvp.profile_id} className="space-y-1 py-3 text-sm">
                        <p className="break-words font-medium">{member?.character_name || `Gracz ${rsvp.profile_id}`}{rsvp.profile_id === user.id && " (Ty)"}</p>
                        <p className="text-xs text-muted-foreground">{member?.character_class ? CLASS_LABELS[member.character_class] : "Brak klasy w profilu"}{member?.realm ? ` / ${member.realm}` : ""}</p>
                        {target > 0 && index >= target && <Badge variant="outline">Ponad cel składu</Badge>}
                      </li>;
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {(isOfficer || event.created_by === user.id) && event.status === "scheduled" && (
        <section className="mt-8 space-y-4 rounded-xl border p-5"><h2 className="font-semibold">Zarządzanie wydarzeniem</h2><CancelEventForm eventId={event.id} /></section>
      )}
    </main>
  );
}
