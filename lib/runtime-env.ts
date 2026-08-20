import { env } from "cloudflare:workers";

export function runtimeEnv(name: string): string {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : "";
}

export function isConfigured(name: string): boolean {
  return runtimeEnv(name).length > 0;
}
