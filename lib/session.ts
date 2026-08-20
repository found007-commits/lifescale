import { headers } from "next/headers";
import { auth } from "./auth";

export async function currentUser() {
  const result = await auth.api.getSession({ headers: await headers() });
  return result?.user ?? null;
}
