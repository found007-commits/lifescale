import test from "node:test";
import assert from "node:assert/strict";
import { GET, dynamic, revalidate } from "../app/api/miniprogram/service-config/route";

test("static mini configuration contains only public connection settings and fails closed", async () => {
  const beforeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const beforeKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-public";
    const response = GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { supabaseUrl: "https://synthetic.invalid", publishableKey: "synthetic-public" });
    assert.equal(dynamic, "force-static");
    assert.equal(revalidate, 3600);
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(GET().status, 503);
  } finally {
    if (beforeUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = beforeKey;
  }
});
