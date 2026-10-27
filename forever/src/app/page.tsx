import Link from "next/link";
import { ArrowRight, CalendarDays, Shield, Swords, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function Home() {
  const configured = isSupabaseConfigured();
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between border-b pb-6">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold tracking-widest">
          <Shield className="size-8 text-primary" aria-hidden="true" /> FOREVER
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>Zaloguj się</Link>
      </header>
      <section className="relative py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,oklch(0.8_0.14_80/0.12),transparent_65%)]" />
        <Badge variant="outline" className="mb-6 text-primary">WORLD OF WARCRAFT / SIEDZIBA GILDII</Badge>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Wielkie przygody.<br /><span className="text-primary">Jeszcze lepsza ekipa.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Witaj w Forever. To dom naszej gildii, miejsce dla twojej postaci
          i początek kolejnej wspólnej przygody.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg" })}>
            Zarejestruj się <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline" })}>Panel główny</Link>
        </div>
      </section>
      {!configured && (
        <aside className="mb-8 rounded-xl border border-primary/40 bg-primary/5 p-5 text-sm" role="status">
          <strong>Wymagana konfiguracja.</strong> Połącz projekt Supabase, ustawiając zmienne środowiskowe
          opisane w README, a następnie uruchom migrację bazy danych. Logowanie będzie dostępne po zakończeniu konfiguracji.
        </aside>
      )}
      <section aria-label="Funkcje gildii" className="grid gap-5 md:grid-cols-3">
        {[
          { icon: Users, title: "Twoje konto, twoja gildia", text: "Zarejestruj się i potwierdź e-mail. Dane postaci uzupełnisz opcjonalnie w zakładce „Twój Profil”.", phase: "Dostępne po konfiguracji" },
          { icon: CalendarDays, title: "Zarezerwuj czas na przygodę", text: "Każdy organizuje aktywności. Wydarzenia oficerów są wyróżnione na czerwono.", phase: "Kalendarz i zapisy" },
          { icon: Swords, title: "Nie wyruszaj samotnie", text: "Planujemy wyszukiwanie grup i powiadomienia na Discordzie.", phase: "Wkrótce: wyszukiwanie grup" },
        ].map(({ icon: Icon, title, text, phase }) => (
          <Card key={title}>
            <CardHeader><Icon className="mb-3 size-6 text-primary" aria-hidden="true" /><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent><p className="mb-5 text-muted-foreground">{text}</p><Badge variant="secondary">{phase}</Badge></CardContent>
          </Card>
        ))}
      </section>
      <footer className="mt-16 border-t py-6 text-sm text-muted-foreground">Forever / Dla ludzi, którzy stoją za postaciami.</footer>
    </main>
  );
}
