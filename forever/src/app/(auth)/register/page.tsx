import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function RegisterPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  return <AuthForm mode="register" />;
}
