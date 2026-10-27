"use server";

import { revalidatePath } from "next/cache";
import { getMemberContext } from "@/lib/auth";
import { createWritableClient } from "@/lib/supabase/server";
import { profileSchema, type FormState } from "@/lib/validation";

export async function saveProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const { user } = await getMemberContext();
  const parsed = profileSchema.safeParse({
    ...Object.fromEntries(formData),
    primary_professions: [formData.get("profession_one"), formData.get("profession_two")].filter((value) => value !== "" && value !== null),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createWritableClient();
  const { error } = await supabase.from("profiles").update(parsed.data)
    .eq("id", user.id).select("id").single();
  if (error) {
    console.error("Profile update failed", { code: error.code });
    return { error: "Nie udało się zapisać postaci. Spróbuj ponownie." };
  }
  revalidatePath("/", "layout");
  return { success: "Profil został zapisany. Możesz go zmienić w dowolnym momencie." };
}
