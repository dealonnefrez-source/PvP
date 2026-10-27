"use server";

import { revalidatePath } from "next/cache";
import { getMemberContext } from "@/lib/auth";
import { isGuildOfficer, GUILD_ROLES } from "@/lib/guild";
import { z, type FormState } from "@/lib/validation";
import { createWritableClient } from "@/lib/supabase/server";

export async function changeGuildRole(_previous: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await getMemberContext();
  if (!isGuildOfficer(profile.guild_role)) return { error: "Nie masz uprawnień do zmiany ról." };
  const parsed = z.object({
    profile_id: z.uuid("Nieprawidłowy gracz."),
    guild_role: z.enum(GUILD_ROLES, { error: "Wybierz prawidłową rolę gildii." }),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createWritableClient();
  const { error } = await supabase.rpc("set_guild_role", {
    p_profile_id: parsed.data.profile_id, p_role: parsed.data.guild_role,
  });
  if (error) {
    console.error("Guild role change failed", { code: error.code });
    return { error: "Nie udało się zmienić roli. Odśwież stronę i sprawdź uprawnienia." };
  }
  revalidatePath("/", "layout");
  return { success: "Rola została zmieniona." };
}
