// One round trip for the dashboard instead of profile -> three reads -> batch signing.
//
// This module holds the policy only; `app/api/miniprogram/bootstrap/route.ts` wires it to
// Supabase. Every read below is executed with the caller's own access token, so RLS filters
// exactly what it filters from the device — this removes round trips, never the checks.
//
// The unit tests exercise these functions against synthetic reads, so the ordering rule
// (profile first, records second) stays true without touching a network.

export const ENTRY_LIMIT = 3;
export const CHECKIN_LIMIT = 7;
export const MEDIA_TTL_SECONDS = 3600;

// Mirrors miniprogram/utils/setup-policy.js: an account created through WeChat, with no
// email of its own. The two implementations are compared in tests/bootstrap-215.test.ts so
// they cannot drift apart.
export const isWechatOnlyAccount = (email?: string | null) => Boolean(email) && /@wechat\.lifescale\.invalid$/i.test(email as string);

export type BootstrapMedia = {
  id: string;
  storage_path: string;
  media_type?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};
export type BootstrapEntry = {
  id: string;
  entry_media?: BootstrapMedia[] | null;
  [key: string]: unknown;
};
export type BootstrapRow = { [key: string]: unknown };

export type BootstrapReads = {
  profile(userId: string): Promise<BootstrapRow | null>;
  entries(userId: string, limit: number): Promise<BootstrapEntry[]>;
  checkins(userId: string, limit: number): Promise<BootstrapRow[]>;
  checkinCount(userId: string): Promise<number>;
  signMedia(paths: string[], expiresIn: number): Promise<Array<{ path?: string | null; signedUrl?: string | null }>>;
};

export type BootstrapPayload = {
  profile: BootstrapRow | null;
  setupRequired: boolean;
  entries: BootstrapEntry[];
  checkins: BootstrapRow[];
  checkinCount: number;
};

// Only stills are signed by the list view, exactly as utils/supabase.js does today: a video
// or a GIF keeps its placeholder instead of being handed to an image decoder.
export function isSignableImage(media: BootstrapMedia) {
  const type = typeof media.media_type === "string" ? media.media_type : "";
  return !(type.startsWith("video/") || type === "image/gif");
}

// Signed URLs come back absolute from newer Storage versions and rooted at the storage API
// from older ones. Accept only the shapes that resolve inside our own project.
export function absoluteMediaUrl(value: string | null | undefined, supabaseUrl: string) {
  if (!value) return "";
  const root = String(supabaseUrl || "").replace(/\/$/, "");
  if (!root.startsWith("https://")) return "";
  if (value.startsWith(`${root}/storage/v1/object/sign/entry-media/`)) return value;
  if (value.startsWith("/storage/v1/object/sign/entry-media/")) return `${root}${value}`;
  if (value.startsWith("/object/sign/entry-media/")) return `${root}/storage/v1${value}`;
  return "";
}

function mediaOrder(a: BootstrapMedia, b: BootstrapMedia) {
  return String(a.created_at || "").localeCompare(String(b.created_at || "")) || String(a.id || "").localeCompare(String(b.id || ""));
}

export async function loadDashboardBootstrap(
  userId: string,
  email: string | null | undefined,
  reads: BootstrapReads,
  supabaseUrl: string,
): Promise<BootstrapPayload> {
  const profile = await reads.profile(userId);
  // The privacy rule the dashboard already followed on the device: an account that joined
  // through WeChat must complete its profile before a single record is read. Returning here
  // is what makes that guarantee hold — nothing below this line touches entries.
  if (isWechatOnlyAccount(email) && !profile?.onboarding_completed) {
    return { profile: profile ?? null, setupRequired: true, entries: [], checkins: [], checkinCount: 0 };
  }

  const [entries, checkins, checkinCount] = await Promise.all([
    reads.entries(userId, ENTRY_LIMIT),
    reads.checkins(userId, CHECKIN_LIMIT),
    reads.checkinCount(userId),
  ]);

  const rows = Array.isArray(entries) ? entries : [];
  const paths = [...new Set(
    rows
      .flatMap(entry => (Array.isArray(entry.entry_media) ? entry.entry_media : []))
      .filter(item => item && typeof item.storage_path === "string" && item.storage_path && isSignableImage(item))
      .map(item => item.storage_path),
  )];

  const signed = new Map<string, string>();
  if (paths.length) {
    const results = await reads.signMedia(paths, MEDIA_TTL_SECONDS);
    for (const item of results || []) {
      if (!item?.path) continue;
      const url = absoluteMediaUrl(item.signedUrl, supabaseUrl);
      if (url) signed.set(item.path, url);
    }
  }

  return {
    profile: profile ?? null,
    setupRequired: false,
    entries: rows.map(entry => ({
      ...entry,
      entry_media: (Array.isArray(entry.entry_media) ? entry.entry_media : []).slice().sort(mediaOrder)
        .map(item => ({ ...item, signed_url: signed.get(item.storage_path) ?? "" })),
    })),
    checkins: Array.isArray(checkins) ? checkins : [],
    checkinCount: Number.isFinite(Number(checkinCount)) ? Number(checkinCount) : 0,
  };
}
