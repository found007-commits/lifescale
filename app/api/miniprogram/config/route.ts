import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl?.startsWith("https://") || !publishableKey) {
    return NextResponse.json({ error: "Mini program configuration is unavailable." }, { status: 503 });
  }

  return NextResponse.json(
    { supabaseUrl, publishableKey },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
