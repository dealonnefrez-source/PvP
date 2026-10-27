import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-5 px-6 py-24">
      <h1 className="text-2xl font-bold">Nie znaleziono strony</h1>
      <p className="text-muted-foreground">Ta strona nie istnieje lub została przeniesiona.</p>
      <Link href="/" className={buttonVariants()}>Wróć do siedziby gildii</Link>
    </main>
  );
}
