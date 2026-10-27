"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/validation";
import { clearFieldValidity, localizeFieldValidity } from "@/lib/form-validation";

export function AuthForm({ mode, notice }: { mode: "login" | "register"; notice?: string }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState<FormState, FormData>(registering ? register : login, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{registering ? "Twoja przygoda zaczyna się tutaj" : "Witaj ponownie"}</CardTitle>
        <CardDescription>{registering ? "Utwórz konto gildii. Następnie przedstawisz swoją postać." : "Zaloguj się do siedziby gildii Forever."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-5" onInvalidCapture={localizeFieldValidity} onInputCapture={clearFieldValidity}>
          {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
          <div className="space-y-2">
            <Label htmlFor="email">Adres e-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 12 : 1} maxLength={128} required aria-describedby={registering ? "password-hint" : undefined} />
            {registering && <p id="password-hint" className="text-xs text-muted-foreground">Użyj co najmniej 12 znaków. Warto wybrać unikalną frazę jako hasło.</p>}
          </div>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Proszę czekać..." : registering ? "Zarejestruj się" : "Zaloguj się"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {registering ? "Masz już konto? " : "Nie masz jeszcze konta? "}
          <Link href={registering ? "/login" : "/register"} className="text-primary underline">{registering ? "Zaloguj się" : "Zarejestruj się"}</Link>
        </p>
      </CardContent>
    </Card>
  );
}
