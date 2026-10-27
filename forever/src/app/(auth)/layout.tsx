import Link from "next/link";
import { Shield } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-9 flex items-center justify-center gap-3 text-xl font-bold tracking-widest">
        <Shield className="size-8 text-primary" aria-hidden="true" /> FOREVER
      </Link>
      {children}
    </main>
  );
}
