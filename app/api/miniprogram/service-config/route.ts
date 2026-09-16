import { NextResponse } from "next/server";

// Public, user-independent configuration. Keep /config for older clients whose
// language detection depends on request headers; that response must not be shared.
export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl?.startsWith("https://") || !publishableKey) {
    return NextResponse.json({ error: "Mini program configuration is unavailable." }, { status: 503 });
  }
  return NextResponse.json({ supabaseUrl, publishableKey });
}
