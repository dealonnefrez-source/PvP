import Link from "next/link";
import { getMemberContext } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";

export default async function ProfilePage() {
  const { profile } = await getMemberContext();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold tracking-widest text-primary">FOREVER</Link>
        <form action={logout}><Button type="submit" variant="ghost">Wyloguj się</Button></form>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Twój Profil</CardTitle>
          <CardDescription>Dane postaci są opcjonalne. Uzupełnij wybrane pola teraz, później lub zostaw je puste — masz już dostęp do strony.</CardDescription>
        </CardHeader>
        <CardContent><ProfileForm profile={profile} /></CardContent>
      </Card>
      <Link href="/dashboard" className="mt-6 inline-block text-primary underline">Wróć do panelu głównego</Link>
      <Link href="/events" className="ml-5 mt-6 inline-block text-primary underline">Wydarzenia</Link>
    </main>
  );
}
