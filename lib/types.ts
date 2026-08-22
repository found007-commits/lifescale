export type Locale = "zh" | "en";
export type DisplayMode = "gentle" | "clear";
export type GenderOption = "male" | "female" | "l" | "g" | "b" | "t" | "q" | "private";
export type Visibility = "private" | "public";
export type Mood = "calm" | "happy" | "grateful" | "tired" | "sad" | "anxious" | "hopeful";
export type EntryCategory = "daily" | "family" | "work" | "growth" | "health" | "travel" | "reflection" | "other";

export type LifeProfile = {
  id: string;
  email: string;
  display_name: string | null;
  gender_identity: GenderOption;
  locale: Locale;
  timezone: string;
  birth_date: string;
  target_age: number | null;
  target_date: string;
  target_locked_until: string;
  actual_death_date: string | null;
  display_mode: DisplayMode;
  onboarding_completed: boolean;
  privacy_version: string;
  privacy_accepted_at: string;
  created_at: string;
  updated_at: string;
};

export type EntryMedia = {
  id: string;
  entry_id: string;
  user_id: string;
  storage_path: string;
  media_type: string;
  created_at: string;
  signed_url?: string;
};

export type LifeEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  mood: Mood;
  category: EntryCategory;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  entry_media?: EntryMedia[];
};

export type Checkin = {
  id: string;
  user_id: string;
  checkin_date: string;
  created_at: string;
};

export type AuthUser = {
  id: string;
  email: string;
};
