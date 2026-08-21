"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/client";

export function useLifeScaleSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsPending(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsPending(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, isPending };
}

export async function signOut() {
  return getSupabaseBrowserClient().auth.signOut();
}
