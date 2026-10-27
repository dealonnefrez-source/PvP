import { NextResponse, type NextRequest } from "next/server";
import { createWritableClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/setup", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createWritableClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
    console.error("Auth code exchange failed", { code: error.code, status: error.status });
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
