"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createEvent, type EventFormState } from "@/app/events/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMBAT_ROLES, EVENT_KINDS, RSVP_ROLE_LABELS, localDateTimeToIso } from "@/lib/events";
import { clearFieldValidity, localizeFieldValidity } from "@/lib/form-validation";

export function EventForm() {
  const [dateError, setDateError] = useState<string>();
  const [state, action, pending] = useActionState<EventFormState, FormData>(createEvent, {});
  const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";
  if (state.eventId) return (
    <div className="space-y-4">
      <p role="status" className="text-primary">{state.success}</p>
      {state.warning && <p role="alert" className="text-sm text-primary">{state.warning}</p>}
      <Link href={`/events/${state.eventId}`} className="text-primary underline">Otwórz wydarzenie i listę zapisów</Link>
    </div>
  );
  return (
    <form action={(formData) => {
      try {
        const start = localDateTimeToIso(String(formData.get("local_start")));
        formData.set("starts_at", start);
        const end = String(formData.get("local_end") ?? "");
        formData.set("ends_at", end ? localDateTimeToIso(end) : new Date(Date.parse(start) + 60 * 60 * 1000).toISOString());
      } catch (error) {
        setDateError(error instanceof Error ? error.message : "Sprawdź datę i godzinę.");
        return;
      }
      setDateError(undefined);
      action(formData);
    }} className="space-y-5" onInvalidCapture={localizeFieldValidity} onInputCapture={clearFieldValidity}>
      <div className="space-y-2"><Label htmlFor="title">Nazwa wydarzenia</Label><Input id="title" name="title" required minLength={3} maxLength={120} placeholder="Np. Premade BG — piątkowy wieczór" /></div>
      <div className="space-y-2">
        <Label htmlFor="event_type">Typ (opcjonalnie)</Label>
        <select id="event_type" name="event_type" className={selectClass} defaultValue="">
          <option value="">Bez kategorii</option>
          {Object.entries(EVENT_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="local_start">Rozpoczęcie</Label><Input id="local_start" name="local_start" type="datetime-local" required /></div>
        <div className="space-y-2"><Label htmlFor="local_end">Zakończenie (opcjonalnie)</Label><Input id="local_end" name="local_end" type="datetime-local" /></div>
      </div>
      <p className="text-xs text-muted-foreground">Wpisz czas lokalny swojej przeglądarki. Kalendarz i szczegóły pokazują czas polski (Europe/Warsaw), z uwzględnieniem czasu letniego. Przy powtórzonej godzinie jesiennej zmiany czasu przeglądarka wybierze jej pierwsze wystąpienie.</p>
      <p className="text-xs text-muted-foreground">Bez podania zakończenia wydarzenie otrzyma czas trwania jednej godziny.</p>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Docelowy skład (opcjonalnie, maksymalnie 80 osób)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {COMBAT_ROLES.map((role) => {
            const name = role === "tank" ? "tanks_needed" : role === "healer" ? "healers_needed" : "dps_needed";
            return <div key={role} className="space-y-2"><Label htmlFor={name}>{RSVP_ROLE_LABELS[role]}</Label><Input id={name} name={name} type="number" min={0} max={80} step={1} defaultValue={0} /></div>;
          })}
        </div>
        <p className="text-xs text-muted-foreground">To cele składu, nie limity zapisów. Nadwyżka będzie widoczna — nie ma automatycznej rezerwy.</p>
      </fieldset>
      <div className="space-y-2"><Label htmlFor="description">Opis — co będziemy robić</Label><textarea id="description" name="description" required maxLength={4000} rows={4} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" /></div>
      {(dateError || state.error) && <p role="alert" className="text-sm text-destructive">{dateError || state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Zapisywanie..." : "Zaplanuj wydarzenie"}</Button>
    </form>
  );
}
