"use client";

import { z } from "zod";
import { getSupabaseBrowserClient } from "./supabase/client";
import type { Checkin, EntryCategory, EntryMedia, LifeEntry, LifeProfile, Locale, Mood, Visibility } from "./types";

export const profileInputSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().trim().max(80).nullable(),
  gender_identity: z.enum(["male", "female", "l", "g", "b", "t", "q", "private"]),
  locale: z.enum(["zh", "zh-TW", "en"]),
  timezone: z.string().min(1).max(100),
  birth_date: z.iso.date(),
  target_age: z.number().int().min(30).max(150).nullable(),
  target_date: z.iso.date(),
  display_mode: z.enum(["gentle", "clear"]),
  onboarding_completed: z.literal(true),
  privacy_version: z.string().max(32),
  privacy_accepted_at: z.iso.datetime(),
});

const entryInputSchema = z.object({
  user_id: z.string().uuid(),
  entry_date: z.iso.datetime(),
  content: z.string().max(12000),
  mood: z.enum(["calm", "happy", "grateful", "tired", "sad", "anxious", "hopeful"]),
  category: z.enum(["daily", "family", "work", "growth", "health", "travel", "reflection", "other"]),
  visibility: z.enum(["private", "public"]),
});

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export async function loadLifeScaleData(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const [profileResult, entriesResult, checkinsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("life_entries").select("*, entry_media(*)").eq("user_id", userId).order("entry_date", { ascending: false }),
    supabase.from("checkins").select("*").eq("user_id", userId).order("checkin_date", { ascending: false }),
  ]);
  if (profileResult.error) throw new Error(errorMessage(profileResult.error, "Could not load profile."));
  if (entriesResult.error) throw new Error(errorMessage(entriesResult.error, "Could not load entries."));
  if (checkinsResult.error) throw new Error(errorMessage(checkinsResult.error, "Could not load check-ins."));

  const entries = (entriesResult.data || []) as unknown as LifeEntry[];
  const paths = entries.flatMap((entry) => (entry.entry_media || []).map((media) => media.storage_path));
  let signedUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("entry-media").createSignedUrls(paths, 3600);
    const urlPairs: Array<[string, string]> = [];
    for (const [index, item] of (data || []).entries()) {
      if (item.signedUrl) urlPairs.push([paths[index], item.signedUrl]);
    }
    signedUrls = new Map(urlPairs);
  }
  const entriesWithUrls = entries.map((entry) => ({
    ...entry,
    entry_media: (entry.entry_media || []).map((media) => ({ ...media, signed_url: signedUrls.get(media.storage_path) })),
  }));
  return {
    profile: profileResult.data as LifeProfile | null,
    entries: entriesWithUrls,
    checkins: (checkinsResult.data || []) as Checkin[],
  };
}

export async function createProfile(input: z.input<typeof profileInputSchema>) {
  const parsed = profileInputSchema.parse(input);
  const { data, error } = await getSupabaseBrowserClient().from("profiles").insert(parsed).select("*").single();
  if (error) throw new Error(errorMessage(error, "Could not save your LifeScale."));
  return data as LifeProfile;
}

export async function updateProfile(userId: string, values: Partial<Pick<LifeProfile, "display_name" | "gender_identity" | "locale" | "timezone" | "display_mode" | "birth_date" | "target_age" | "target_date">>) {
  const { data, error } = await getSupabaseBrowserClient().from("profiles").update(values).eq("id", userId).select("*").single();
  if (error) throw new Error(errorMessage(error, "Could not update your profile."));
  return data as LifeProfile;
}

export async function createEntry(input: { id?: string; userId: string; entryDate: string; content: string; mood: Mood; category: EntryCategory; visibility: Visibility; checkinDate: string }) {
  const parsed = entryInputSchema.parse({ user_id: input.userId, entry_date: input.entryDate, content: input.content, mood: input.mood, category: input.category, visibility: input.visibility });
  const id = input.id || crypto.randomUUID();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("life_entries").insert({ id, ...parsed }).select("*").single();
  if (error) throw new Error(errorMessage(error, "Could not save this entry."));
  const { error: checkinError } = await supabase.from("checkins").upsert({ user_id: input.userId, checkin_date: input.checkinDate }, { onConflict: "user_id,checkin_date", ignoreDuplicates: true });
  if (checkinError) throw new Error(errorMessage(checkinError, "Entry saved, but check-in could not be updated."));
  return { ...(data as LifeEntry), entry_media: [] };
}

export async function updateEntry(entryId: string, userId: string, input: { content: string; mood: Mood; category: EntryCategory; visibility: Visibility }) {
  const parsed = entryInputSchema.pick({ content: true, mood: true, category: true, visibility: true }).parse(input);
  const { data, error } = await getSupabaseBrowserClient().from("life_entries").update(parsed).eq("id", entryId).eq("user_id", userId).select("*").single();
  if (error) throw new Error(errorMessage(error, "Could not update this entry."));
  return data as LifeEntry;
}

export async function uploadEntryImage(userId: string, entryId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10 MB or smaller.");
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const path = `${userId}/${entryId}/${crypto.randomUUID()}.${extension}`;
  const supabase = getSupabaseBrowserClient();
  const { error: uploadError } = await supabase.storage.from("entry-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(errorMessage(uploadError, "Could not upload the image."));
  const { data, error } = await supabase.from("entry_media").insert({ entry_id: entryId, user_id: userId, storage_path: path, media_type: file.type }).select("*").single();
  if (error) {
    await supabase.storage.from("entry-media").remove([path]);
    throw new Error(errorMessage(error, "Could not attach the image."));
  }
  const { data: signed } = await supabase.storage.from("entry-media").createSignedUrl(path, 3600);
  return { ...(data as EntryMedia), signed_url: signed?.signedUrl };
}

export async function deleteEntry(entry: LifeEntry) {
  const supabase = getSupabaseBrowserClient();
  const paths = (entry.entry_media || []).map((media) => media.storage_path);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("entry-media").remove(paths);
    if (storageError) throw new Error(errorMessage(storageError, "Could not remove entry images."));
  }
  const { error } = await supabase.from("life_entries").delete().eq("id", entry.id).eq("user_id", entry.user_id);
  if (error) throw new Error(errorMessage(error, "Could not delete this entry."));
}

export async function saveSevenDayReport(input: { userId: string; start: string; end: string; data: Record<string, unknown>; representativeEntryId: string | null }) {
  const { error } = await getSupabaseBrowserClient().from("life_reports").upsert({
    user_id: input.userId,
    report_type: "7d",
    period_start: input.start,
    period_end: input.end,
    report_data: input.data,
    representative_entry_id: input.representativeEntryId,
    visibility: "private",
  }, { onConflict: "user_id,report_type,period_start,period_end" });
  if (error) throw new Error(errorMessage(error, "Could not save this report."));
}

export function localeValue(value: unknown): Locale {
  return value === "en" || value === "zh-TW" ? value : "zh";
}
