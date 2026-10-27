"use client";

import { useActionState, useEffect, useState } from "react";
import { cancelEvent, saveRsvp, withdrawRsvp, type EventFormState } from "@/app/events/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CombatRole } from "@/lib/database.types";
import { COMBAT_ROLES, RSVP_ROLE_LABELS } from "@/lib/events";

export function RsvpForm({ eventId, currentRole, open, startsAt }: {
  eventId: string; currentRole?: CombatRole; open: boolean; startsAt: string;
}) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(
    (previous, formData) => formData.get("intent") === "withdraw"
      ? withdrawRsvp(previous, formData)
      : saveRsvp(previous, formData),
    {},
  );
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.parse(startsAt) <= Date.now()) setExpired(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startsAt]);
  return (
    <div className="space-y-5">
      {open && !expired ? (
        <form action={action} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Wybierz rolę na to wydarzenie</legend>
            <p className="text-xs text-muted-foreground">Rola dotyczy tylko tego zapisu. Nie musisz uzupełniać profilu postaci.</p>
            <div className="flex flex-wrap gap-4">
              {COMBAT_ROLES.map((role) => (
                <Label key={role} className="flex items-center gap-2">
                  <input type="radio" name="role" value={role} defaultChecked={currentRole === role} required
                    onInvalid={(event) => event.currentTarget.setCustomValidity("Wybierz rolę na to wydarzenie.")}
                    onChange={(event) => {
                      event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="role"]').forEach((input) => input.setCustomValidity(""));
                    }} />
                  {RSVP_ROLE_LABELS[role]}
                </Label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={pending}>{pending ? "Zapisywanie..." : currentRole ? "Zmień rolę" : "Biorę udział"}</Button>
        </form>
      ) : <p className="text-sm text-muted-foreground">Zapisy zamknięte — wydarzenie rozpoczęło się, zakończyło lub zostało odwołane.</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
      {currentRole && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="intent" value="withdraw" />
          <p className="text-sm">Twoja rola: <strong>{RSVP_ROLE_LABELS[currentRole]}</strong></p>
          <Button type="submit" variant="outline" disabled={pending}>{pending ? "Proszę czekać..." : "Wycofaj udział"}</Button>
        </form>
      )}
    </div>
  );
}

export function CancelEventForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(cancelEvent, {});
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm("Odwołać wydarzenie? Zapisy zostaną zamknięte, a lista uczestników zachowana.")) event.preventDefault();
    }} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Odwoływanie..." : "Odwołaj wydarzenie"}</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    </form>
  );
}
