import { NextResponse, type NextRequest } from "next/server";
import { createWritableClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!isSupabaseConfigured() || !siteUrl) {
    console.error("Presence endpoint is unavailable: application configuration is missing.");
    return NextResponse.json({ error: "Aplikacja nie została skonfigurowana." }, { status: 503 });
  }
  if (request.headers.get("origin") !== new URL(siteUrl).origin) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 });
  }
  const supabase = await createWritableClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    if (authError && authError.name !== "AuthSessionMissingError") console.error("Presence authentication failed", { code: authError.code });
    return NextResponse.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  }
  const { error } = await supabase.rpc("touch_presence");
  if (error) {
    console.error("Presence update failed", { code: error.code });
    return NextResponse.json({ error: "Nie udało się zaktualizować aktywności." }, { status: error.code === "42501" ? 403 : 500 });
  }
  return new NextResponse(null, { status: 204 });
}
