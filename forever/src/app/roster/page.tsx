import Link from "next/link";
import { getMemberContext } from "@/lib/auth";
import { isGuildOfficer } from "@/lib/guild";
import { CLASS_LABELS, RACE_LABELS, PROFESSION_LABELS } from "@/lib/wow";
import { GUILD_ROLE_LABELS } from "@/lib/labels";
import { GuildRoleForm } from "@/components/guild-role-form";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase, profile } = await getMemberContext();
  const params = await searchParams;
  const rawPage = params.page ?? "1";
  if (!/^[1-9]\d{0,5}$/.test(rawPage)) return <main className="p-8"><p role="alert">Nieprawidłowy numer strony.</p><Link href="/roster" className="text-primary underline">Wróć do członków</Link></main>;
  const page = Number(rawPage);
  const pageSize = 50;
  const { data: members, error, count } = await supabase.from("profiles").select("*", { count: "exact" })
    .order("created_at").order("id").range((page - 1) * pageSize, page * pageSize - 1);
  if (error || count === null) {
    console.error("Roster query failed", { code: error?.code });
    throw new Error("Nie udało się pobrać członków gildii.");
  }
  const canManage = isGuildOfficer(profile.guild_role);
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <nav className="mb-8 flex flex-wrap gap-3" aria-label="Nawigacja członków">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Panel główny</Link>
        <Link href="/events" className={buttonVariants({ variant: "outline" })}>Wydarzenia</Link>
        <Link href="/profile" className={buttonVariants({ variant: "outline" })}>Twój Profil</Link>
      </nav>
      <h1 className="text-3xl font-bold">Członkowie ({count})</h1>
      <p className="my-4 text-sm text-muted-foreground">Wszyscy zarejestrowani gracze, także bez danych postaci. Adresy e-mail nie są ujawniane.</p>
      {canManage && <p className="mb-6 text-sm text-primary">Oficerowie i mistrz gildii mogą nadawać każdą rolę, również sobie. Uważaj, aby nie pozbawić gildii wszystkich osób zarządzających.</p>}
      <ul className="space-y-4">
        {members.map((member) => {
          const name = member.character_name || `Gracz ${member.id}`;
          return (
            <li key={member.id} className="flex flex-wrap items-start justify-between gap-5 rounded-xl border p-5">
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="break-words font-semibold">{name}{member.id === profile.id && " (Ty)"}</h2>
                <Badge variant="secondary">{GUILD_ROLE_LABELS[member.guild_role]}</Badge>
                <p className="text-sm text-muted-foreground">{member.race ? RACE_LABELS[member.race] : "Brak rasy"} / {member.character_class ? CLASS_LABELS[member.character_class] : "Brak klasy"}{member.realm ? ` / ${member.realm}` : ""}</p>
                <p className="text-xs text-muted-foreground">{member.primary_professions.map((value) => PROFESSION_LABELS[value]).join(", ") || "Brak profesji"}</p>
              </div>
              {canManage && <GuildRoleForm key={`${member.id}-${member.guild_role}`} id={member.id} role={member.guild_role} name={name} />}
            </li>
          );
        })}
      </ul>
      {members.length === 0 && <p className="my-6">Brak graczy na tej stronie.</p>}
      <nav className="mt-6 flex flex-wrap items-center gap-4" aria-label="Strony członków">
        {page > 1 && <Link href={`/roster?page=${page - 1}`} className="text-primary underline">Poprzednia strona</Link>}
        <span className="text-sm">Strona {page} / {Math.max(1, Math.ceil(count / pageSize))}</span>
        {page * pageSize < count && <Link href={`/roster?page=${page + 1}`} className="text-primary underline">Następna strona</Link>}
      </nav>
    </main>
  );
}
