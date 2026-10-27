import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <Card>
        <CardHeader><CardTitle>Połącz Forever z Supabase</CardTitle></CardHeader>
        <CardContent className="space-y-5 leading-relaxed text-muted-foreground">
          <p>Logowanie wymaga skonfigurowanego projektu Supabase. Zgodnie z instrukcją w README ustaw zmienne środowiskowe, uruchom migrację bazy danych i skonfiguruj potwierdzanie adresu e-mail.</p>
          <p>Konta demonstracyjne i symulowane logowanie nie są dostępne.</p>
          <Link href="/" className="text-primary underline">Wróć do siedziby gildii</Link>
        </CardContent>
      </Card>
    </main>
  );
}
