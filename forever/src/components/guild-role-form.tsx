"use client";

import { useActionState } from "react";
import { changeGuildRole } from "@/app/roster/actions";
import type { GuildRole } from "@/lib/database.types";
import { GUILD_ROLES } from "@/lib/guild";
import { GUILD_ROLE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/validation";

export function GuildRoleForm({ id, role, name }: { id: string; role: GuildRole; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeGuildRole, {});
  return (
    <form action={action} className="space-y-2" onSubmit={(event) => {
      if (!window.confirm(`Zmienić rolę gracza „${name}”? Oficer i mistrz gildii mogą zarządzać wszystkimi rolami.`)) event.preventDefault();
    }}>
      <input type="hidden" name="profile_id" value={id} />
      <Label htmlFor={`role-${id}`} className="sr-only">Rola gracza {name}</Label>
      <div className="flex flex-wrap gap-2">
        <select id={`role-${id}`} name="guild_role" defaultValue={role} disabled={pending} className="h-9 max-w-full rounded-lg border bg-background px-2 text-sm">
          {GUILD_ROLES.map((value) => <option key={value} value={value}>{GUILD_ROLE_LABELS[value]}</option>)}
        </select>
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Zapisywanie..." : "Zapisz rolę"}</Button>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    </form>
  );
}
