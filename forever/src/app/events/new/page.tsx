import Link from "next/link";
import { EventForm } from "@/components/event-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventContext } from "@/lib/event-data";

export default async function NewEventPage() {
  await getEventContext();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/events" className="mb-6 inline-block text-primary underline">Wróć do wydarzeń</Link>
        <Card>
          <CardHeader><CardTitle className="text-2xl">Zaplanuj wydarzenie</CardTitle><CardDescription>Każdy członek gildii może zorganizować aktywność. Podaj termin i opisz, co będziecie robić.</CardDescription></CardHeader>
          <CardContent><EventForm /></CardContent>
        </Card>
    </main>
  );
}
