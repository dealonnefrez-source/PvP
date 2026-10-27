import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const params = await searchParams;
  const notice = params.error === "confirmation"
    ? "Link potwierdzający jest nieprawidłowy lub wygasł. Jeśli konto jest już potwierdzone, zaloguj się. W przeciwnym razie skontaktuj się z administratorem gildii."
    : params.notice === "verify-email" ? "Potwierdź adres e-mail, aby kontynuować." : undefined;
  return <AuthForm mode="login" notice={notice} />;
}
