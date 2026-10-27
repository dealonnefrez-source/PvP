"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createWritableClient } from "@/lib/supabase/server";
import { loginSchema, registrationSchema, type FormState } from "@/lib/validation";

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createWritableClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("Login failed", { code: error.code, status: error.status });
    return { error: error.code === "email_not_confirmed" ? "Potwierdź adres e-mail przed zalogowaniem." : "Nie udało się zalogować. Sprawdź dane logowania lub spróbuj ponownie później." };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function register(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("Registration unavailable: NEXT_PUBLIC_SITE_URL is missing");
    return { error: "Rejestracja nie została skonfigurowana. Skontaktuj się z administratorem gildii." };
  }
  const supabase = await createWritableClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: new URL("/auth/callback", siteUrl).toString() },
  });
  if (error) {
    console.error("Registration failed", { code: error.code, status: error.status });
    return { error: "Nie udało się zarejestrować. Spróbuj ponownie później lub skontaktuj się z administratorem gildii." };
  }
  return { success: "Sprawdź skrzynkę e-mail i kliknij link potwierdzający. Po potwierdzeniu nowe konto uzyska dostęp do strony bez uzupełniania profilu. Jeśli masz już konto, zaloguj się." };
}

export async function logout() {
  const supabase = await createWritableClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout failed", { code: error.code, status: error.status });
    throw new Error("Nie udało się wylogować. Spróbuj ponownie.");
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
