import Link from "next/link";
import { EventForm } from "@/components/event-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventContext } from "@/lib/event-data";

export default async function NewEventPage() {
  const { isOfficer } = await getEventContext();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/events" className="mb-6 inline-block text-primary underline">Wróć do wydarzeń</Link>
      {isOfficer ? (
        <Card>
          <CardHeader><CardTitle className="text-2xl">Zaplanuj wydarzenie</CardTitle><CardDescription>Ustal termin i docelowy skład. Każdy uczestnik sam wybierze rolę przy zapisie.</CardDescription></CardHeader>
          <CardContent><EventForm /></CardContent>
        </Card>
      ) : <section role="alert" className="space-y-3 rounded-xl border p-6"><h1 className="text-xl font-bold">Brak uprawnień</h1><p>Planowanie wydarzeń jest dostępne tylko dla oficerów i administratorów gildii.</p></section>}
    </main>
  );
}
