"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Page failed", error); }, [error]);
  return (
    <main className="mx-auto max-w-lg space-y-5 px-6 py-24">
      <h1 className="text-2xl font-bold">W siedzibie gildii wystąpił problem.</h1>
      <p className="text-muted-foreground">Nie udało się wczytać strony. Spróbuj ponownie. Jeśli problem będzie się powtarzał, skontaktuj się z administratorem gildii, aby sprawdził połączenie z Supabase i migrację bazy danych.</p>
      {error.digest && <p className="text-xs text-muted-foreground">Identyfikator błędu: {error.digest}</p>}
      <Button onClick={reset}>Spróbuj ponownie</Button>
    </main>
  );
}
