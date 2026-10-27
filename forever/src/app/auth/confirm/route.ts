import { NextResponse, type NextRequest } from "next/server";
import { createWritableClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/setup", request.url));
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash && (type === "signup" || type === "email")) {
    const supabase = await createWritableClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
    console.error("Email confirmation failed", { code: error.code, status: error.status });
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
