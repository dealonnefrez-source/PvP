import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventContext } from "@/lib/event-data";
import { calendarMonth, EVENT_KINDS, formatEventTime, guildDateKey } from "@/lib/events";
import { EVENT_STATUS_LABELS } from "@/lib/labels";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { supabase, isOfficer, fetchedAt } = await getEventContext();
  const params = await searchParams;
  const requested = params.month ?? guildDateKey(new Date(fetchedAt).toISOString()).slice(0, 7);
  let calendar;
  try {
    calendar = calendarMonth(requested);
  } catch {
    return <main className="mx-auto max-w-xl space-y-4 px-6 py-16"><h1 className="text-2xl font-bold">Nieprawidłowy miesiąc</h1><p role="alert">Wybierz miesiąc z lat 2000–2100.</p><Link href="/events" className="text-primary underline">Wróć do kalendarza</Link></main>;
  }
  const { data: events, count, error } = await supabase.from("events").select("*", { count: "exact" })
    .gte("starts_at", calendar.from).lt("starts_at", calendar.to).order("starts_at").limit(1000);
  if (error || count === null || count > (events?.length ?? 0)) {
    console.error("Event calendar query failed or was truncated", { code: error?.code, count });
    throw new Error("Nie udało się wczytać pełnego kalendarza wydarzeń.");
  }
  const monthEvents = events.filter((event) => guildDateKey(event.starts_at).startsWith(requested));
  const byDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = guildDateKey(event.starts_at);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <Link href="/dashboard" className="font-bold tracking-widest text-primary">FOREVER</Link>
        <nav className="flex flex-wrap gap-3" aria-label="Nawigacja wydarzeń">
          <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>Panel główny</Link>
          <Link href="/profile" className={buttonVariants({ variant: "outline" })}>Twój Profil</Link>
          {isOfficer && <Link href="/events/new" className={buttonVariants()}>Zaplanuj wydarzenie</Link>}
        </nav>
      </header>
      <h1 className="flex items-center gap-3 text-3xl font-bold"><CalendarDays className="text-primary" aria-hidden="true" />Wydarzenia</h1>
      <p className="mt-3 text-sm text-muted-foreground">Kalendarz gildii i zapisy na PvP. Terminy podajemy w czasie polskim (Europe/Warsaw). Dane postaci pozostają opcjonalne.</p>
      {!isOfficer && <p className="mt-2 text-sm text-muted-foreground">Nowe wydarzenia planują oficerowie i administratorzy.</p>}
      <section className="mt-8 rounded-xl border p-3 sm:p-5" aria-label="Kalendarz miesięczny">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link href={`/events?month=${calendar.previous}`} aria-label="Poprzedni miesiąc" className={buttonVariants({ variant: "outline", size: "icon" })}><ChevronLeft aria-hidden="true" /></Link>
          <h2 className="text-lg font-semibold capitalize">{calendar.label}</h2>
          <Link href={`/events?month=${calendar.next}`} aria-label="Następny miesiąc" className={buttonVariants({ variant: "outline", size: "icon" })}><ChevronRight aria-hidden="true" /></Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map((day) => <div key={day} className="pb-2 text-center text-xs text-muted-foreground">{day}</div>)}
          {calendar.days.map((day) => {
            const dayEvents = byDay.get(day) ?? [];
            return (
              <div key={day} className={`min-w-0 rounded-md border p-1 sm:min-h-24 sm:p-2 ${day.startsWith(requested) ? "" : "bg-muted/30 text-muted-foreground"}`}>
                <time dateTime={day} className="text-xs">{Number(day.slice(-2))}</time>
                <ul className="mt-1 space-y-1">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <Link href={`/events/${event.id}`} title={`${event.title} — ${EVENT_STATUS_LABELS[event.status]}`}
                        className={`block truncate rounded bg-primary/10 p-1 text-[10px] text-primary sm:text-xs ${event.status === "cancelled" ? "line-through" : ""}`}>
                        <span className="sm:hidden">{event.status === "cancelled" ? "Odwoł." : "Event"}</span><span className="hidden sm:inline">{event.title}</span>
                        <span className="sr-only sm:hidden">: {event.title}, {EVENT_STATUS_LABELS[event.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mt-8 space-y-4" aria-label="Lista wydarzeń w miesiącu">
        <h2 className="text-xl font-semibold">Wydarzenia w tym miesiącu ({monthEvents.length})</h2>
        {monthEvents.length === 0 && <p className="rounded-xl border border-dashed p-6 text-muted-foreground">Brak wydarzeń w tym miesiącu. Sprawdź kolejny miesiąc lub poproś oficera o zaplanowanie spotkania.</p>}
        {monthEvents.map((event) => (
          <Card key={event.id}>
            <CardHeader><div className="flex flex-wrap gap-2"><Badge variant="outline">{EVENT_KINDS[event.event_type]}</Badge><Badge variant="secondary">{EVENT_STATUS_LABELS[event.status]}</Badge></div><CardTitle><Link href={`/events/${event.id}`} className="hover:text-primary">{event.title}</Link></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground"><time dateTime={event.starts_at}>{formatEventTime(event.starts_at)}</time> — <time dateTime={event.ends_at}>{formatEventTime(event.ends_at)}</time></p>
              <Link href={`/events/${event.id}`} className="text-sm text-primary underline">Szczegóły, skład i zapisy</Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
