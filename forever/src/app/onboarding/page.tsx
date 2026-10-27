import Link from "next/link";
import { getMemberContext } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";

export default async function OnboardingPage() {
  const { profile } = await getMemberContext();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <Link href={profile.onboarded_at ? "/dashboard" : "/"} className="font-bold tracking-widest text-primary">FOREVER</Link>
        <form action={logout}><Button type="submit" variant="ghost">Wyloguj się</Button></form>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{profile.onboarded_at ? "Twoja postać" : "Kim jesteś w Azeroth?"}</CardTitle>
          <CardDescription>Przedstaw gildii swoją główną postać.</CardDescription>
        </CardHeader>
        <CardContent><OnboardingForm profile={profile} /></CardContent>
      </Card>
    </main>
  );
}
