"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHARACTER_CLASSES, PROFESSIONS, RACES } from "@/lib/wow";
import type { FormState } from "@/lib/validation";
import type { Profile } from "@/lib/database.types";
import { CLASS_LABELS, PROFESSION_LABELS, RACE_LABELS } from "@/lib/wow";
import { clearFieldValidity, localizeFieldValidity } from "@/lib/form-validation";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
  return (
    <form action={action} className="space-y-6" onInvalidCapture={localizeFieldValidity} onInputCapture={clearFieldValidity} onChangeCapture={clearFieldValidity}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="character_name">Nazwa postaci (opcjonalnie)</Label><Input id="character_name" name="character_name" defaultValue={profile.character_name ?? ""} minLength={2} maxLength={24} /></div>
        <div className="space-y-2"><Label htmlFor="realm">Serwer (opcjonalnie)</Label><Input id="realm" name="realm" defaultValue={profile.realm ?? ""} minLength={2} maxLength={80} /></div>
        {[
          { name: "race", label: "Rasa", placeholder: "Wybierz rasę", options: RACES.map((value) => ({ value, label: RACE_LABELS[value] })), value: profile.race },
          { name: "character_class", label: "Klasa", placeholder: "Wybierz klasę", options: CHARACTER_CLASSES.map((value) => ({ value, label: CLASS_LABELS[value] })), value: profile.character_class },
        ].map(({ name, label, placeholder, options, value }) => (
          <div className="space-y-2" key={name}>
            <Label htmlFor={name}>{label} (opcjonalnie)</Label>
            <select id={name} name={name} className={selectClass} defaultValue={value ?? ""}>
              <option value="">Nie wybrano — {placeholder.toLowerCase()}</option>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Profesje główne</legend>
        <p className="text-sm text-muted-foreground">Wybierz maksymalnie dwie profesje. Możesz zostawić te pola puste, jeśli jeszcze żadnej nie znasz.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {["profession_one", "profession_two"].map((name, index) => (
            <div className="space-y-2" key={name}>
              <Label htmlFor={name}>Profesja {index + 1}</Label>
              <select id={name} name={name} className={selectClass} defaultValue={profile.primary_professions[index] ?? ""}>
                <option value="">Brak</option>
                {PROFESSIONS.map((profession) => <option key={profession} value={profession}>{PROFESSION_LABELS[profession]}</option>)}
              </select>
            </div>
          ))}
        </div>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Zapisywanie profilu..." : "Zapisz profil"}</Button>
    </form>
  );
}
