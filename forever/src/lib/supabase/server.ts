import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { getSupabaseConfig } from "./config";

// Server Components are read-only: the proxy refreshes their session cookies.
export async function createClient() {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: { getAll: () => cookieStore.getAll() },
  });
}

export async function createWritableClient() {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}
