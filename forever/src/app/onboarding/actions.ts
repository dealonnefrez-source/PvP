"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMemberContext } from "@/lib/auth";
import { createWritableClient } from "@/lib/supabase/server";
import { onboardingSchema, type FormState } from "@/lib/validation";

export async function completeOnboarding(_previous: FormState, formData: FormData): Promise<FormState> {
  await getMemberContext();
  const parsed = onboardingSchema.safeParse({
    ...Object.fromEntries(formData),
    primary_professions: [formData.get("profession_one"), formData.get("profession_two")].filter((value) => value !== "" && value !== null),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createWritableClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_character_name: parsed.data.character_name,
    p_realm: parsed.data.realm,
    p_race: parsed.data.race,
    p_character_class: parsed.data.character_class,
    p_primary_professions: parsed.data.primary_professions,
  });
  if (error) {
    console.error("Onboarding failed", { code: error.code });
    return { error: "Nie udało się zapisać postaci. Spróbuj ponownie." };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
