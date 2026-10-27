import Link from "next/link";
import { Shield, UserRound, Users } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberContext } from "@/lib/auth";
import { CLASS_LABELS, PROFESSION_LABELS, RACE_LABELS } from "@/lib/wow";

export default async function DashboardPage() {
  const { supabase, profile } = await getMemberContext();
  const { data: activePlayers, error } = await supabase.rpc("active_players");
  if (error) {
    console.error("Active player query failed", { code: error.code });
    throw new Error("Nie udało się wczytać aktywnych graczy. Spróbuj ponownie.");
  }
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold tracking-widest"><Shield className="text-primary" aria-hidden="true" /> FOREVER</Link>
        <nav className="flex flex-wrap items-center gap-3" aria-label="Nawigacja członka gildii">
          <Link href="/events" className={buttonVariants()}>Wydarzenia</Link>
          <Link href="/profile" className={buttonVariants({ variant: "outline" })}>Twój Profil</Link>
          <form action={logout}><Button type="submit" variant="ghost">Wyloguj się</Button></form>
        </nav>
      </header>
      <Badge variant="outline" className="mb-4 text-primary">PANEL GŁÓWNY</Badge>
      <h1 className="text-3xl font-bold md:text-4xl">{profile.character_name ? `Witaj w domu, ${profile.character_name}.` : "Witaj w gildii Forever!"}</h1>
      <p className="mb-8 mt-3 text-muted-foreground">Znajoma ekipa. Nowa przygoda. To właśnie Forever.</p>
      <PresenceHeartbeat />
      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><UserRound className="mb-2 text-primary" aria-hidden="true" /><CardTitle>Twoja postać</CardTitle><CardDescription>Opcjonalne informacje — możesz uzupełnić je w dowolnym momencie.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xl font-semibold">{profile.character_name || "Nie podano nazwy postaci"} <span className="text-sm font-normal text-muted-foreground">{profile.realm ? `/ ${profile.realm}` : ""}</span></p>
            <p>{profile.race ? RACE_LABELS[profile.race] : "Nie wybrano rasy"} / {profile.character_class ? CLASS_LABELS[profile.character_class] : "Nie wybrano klasy"}</p>
            <p className="text-muted-foreground">{profile.primary_professions.map((profession) => PROFESSION_LABELS[profession]).join(" / ") || "Nie wybrano profesji głównych"}</p>
            <Link href="/profile" className="inline-block text-primary underline">Uzupełnij lub edytuj profil</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Users className="mb-2 text-primary" aria-hidden="true" /><CardTitle>Aktywni gracze ({activePlayers.length})</CardTitle><CardDescription>Aktywność na stronie w ciągu ostatnich 15 minut. Odśwież stronę, aby zaktualizować listę.</CardDescription></CardHeader>
          <CardContent>
            {activePlayers.length === 0 ? <p className="text-muted-foreground">Brak ostatniej aktywności na stronie. Twoja aktywność pojawi się po kolejnym odświeżeniu.</p> : (
              <ul className="divide-y">
                {activePlayers.map((player) => (
                  <li className="flex items-center justify-between gap-3 py-3" key={player.id}>
                    <span>{player.character_name || "Członek gildii"}<span className="block text-xs text-muted-foreground">{player.realm || "Nie podano serwera"}</span></span>
                    <Badge variant="secondary">{player.character_class ? CLASS_LABELS[player.character_class] : "Nie wybrano klasy"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <aside className="mt-8 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Wydarzenia i zapisy są dostępne w zakładce „Wydarzenia”. Wkrótce: lista członków gildii z filtrami i wyszukiwanie grup.
        Dostęp do strony nie wymaga uzupełniania danych postaci.
      </aside>
    </main>
  );
}
