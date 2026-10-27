import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center gap-3 px-6 text-muted-foreground" role="status">
      <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" />
      Wczytywanie siedziby gildii...
    </main>
  );
}
