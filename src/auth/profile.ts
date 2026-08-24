import { FeedCardType, MbtiType, ProfileStatus, RelationshipGoal, VerificationStatus, ZodiacSign, type CurrentUser, type MediaAsset, type Person, type PersonId, type PersonVerification, type PromptAnswer } from '../domain';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PreferencesRow = Database['public']['Tables']['profile_preferences']['Row'];

/** Neutral placeholder avatar used until photo upload lands (Phase 2). */
export const PLACEHOLDER_PHOTO: MediaAsset = {
  id: 'media_placeholder',
  url: 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900">' +
    '<rect width="100%" height="100%" fill="#f6ecef"/>' +
    '<circle cx="300" cy="330" r="118" fill="#e4cdd8"/>' +
    '<path d="M160 820c0-150 60-230 140-230s140 80 140 230z" fill="#e4cdd8"/>' +
    '</svg>',
  ),
  alt: '默认头像',
  width: 600,
  height: 900,
};

const ZODIAC_BY_MONTH_DAY: readonly (readonly [number, number, ZodiacSign])[] = [
  [1, 20, ZodiacSign.AQUARIUS], [2, 19, ZodiacSign.PISCES], [3, 21, ZodiacSign.ARIES],
  [4, 20, ZodiacSign.TAURUS], [5, 21, ZodiacSign.GEMINI], [6, 22, ZodiacSign.CANCER],
  [7, 23, ZodiacSign.LEO], [8, 23, ZodiacSign.VIRGO], [9, 23, ZodiacSign.LIBRA],
  [10, 24, ZodiacSign.SCORPIO], [11, 23, ZodiacSign.SAGITTARIUS], [12, 22, ZodiacSign.CAPRICORN],
];

export function zodiacFromBirthDate(birth: string): ZodiacSign | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const [limitMonth, limitDay, sign] = ZODIAC_BY_MONTH_DAY.find(([m]) => m === month) as readonly [number, number, ZodiacSign];
  if (!limitMonth) return null;
  return day >= limitDay ? sign : ZODIAC_BY_MONTH_DAY[month - 2]?.[2] ?? ZodiacSign.CAPRICORN;
}

export function ageFromBirthDate(birth: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!match) return null;
  const birthDay = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  let age = today.getFullYear() - birthDay.getFullYear();
  if (today.getMonth() < birthDay.getMonth() || (today.getMonth() === birthDay.getMonth() && today.getDate() < birthDay.getDate())) age -= 1;
  return Number.isFinite(age) && age >= 0 ? age : null;
}

export function profileRowToPerson(row: ProfileRow, birth?: string | null, displayAge?: number | null): Person {
  const age = displayAge ?? (birth ? ageFromBirthDate(birth) : null);
  return {
    entityType: FeedCardType.PERSON,
    id: ('person_' + row.id) as PersonId,
    entityVersion: row.entity_version,
    profileStatus: (row.profile_status as ProfileStatus) || ProfileStatus.DRAFT,
    displayName: row.display_name || '未命名',
    age: age ?? 0,
    city: row.city ?? '',
    occupation: row.occupation ?? '',
    bio: row.bio ?? '',
    relationshipGoal: (row.relationship_goal as RelationshipGoal) || RelationshipGoal.OPEN_TO_EXPLORE,
    mbti: (row.mbti as MbtiType) || MbtiType.UNSURE,
    zodiac: (row.zodiac as ZodiacSign) || (birth ? (zodiacFromBirthDate(birth) ?? ZodiacSign.ARIES) : ZodiacSign.ARIES),
    interests: (Array.isArray(row.interests) ? (row.interests as string[]) : []) as unknown as Person['interests'],
    photos: (Array.isArray(row.photos) && (row.photos as unknown as MediaAsset[]).length > 0 ? row.photos as unknown as MediaAsset[] : [PLACEHOLDER_PHOTO]) as unknown as Person['photos'],
    prompts: Array.isArray(row.prompts) ? (row.prompts as unknown as PromptAnswer[]) : [],
    verification: {
      account: (row.verification as PersonVerification | null)?.account ?? VerificationStatus.UNVERIFIED,
      personhood: (row.verification as PersonVerification | null)?.personhood ?? VerificationStatus.UNVERIFIED,
      profileReview: (row.verification as PersonVerification | null)?.profileReview ?? VerificationStatus.UNVERIFIED,
    },
  };
}

export interface LoadedUserProfile {
  person: Person;
  preferences: PreferencesRow | null;
  isAdmin: boolean;
}

export async function loadUserProfile(userId: string): Promise<LoadedUserProfile | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;
  const { data: preferences } = await supabase
    .from('profile_preferences')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return { person: profileRowToPerson(profile, preferences?.birth_date ?? null), preferences, isAdmin: Boolean(profile.is_admin) };
}

export function buildCurrentUser(loaded: LoadedUserProfile): CurrentUser {
  const { person, preferences } = loaded;
  return {
    profile: person,
    account: { emailVerified: true, phoneVerified: false },
    consent: {
      aiCompatibility: false,
      publicExplanation: false,
      version: 'consent-2026-08',
      updatedAt: new Date().toISOString() as CurrentUser['consent']['updatedAt'],
    },
    privacy: {
      showAge: preferences?.show_age ?? true,
      showZodiac: preferences?.show_zodiac ?? false,
      showOrientation: preferences?.show_orientation ?? false,
      showInConfirmedParticipantLists: true,
      exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY',
      lockScreenMessagePreview: 'HIDDEN',
    },
    stats: { savedActivityCount: 0, activeActivityCount: 0, unreadThreadCount: 0 },
  };
}

export interface OnboardingProfilePayload {
  displayName: string;
  city: string;
  occupation: string;
  bio: string;
  relationshipGoal: RelationshipGoal;
  mbti: string;
  zodiac: string;
  interests: string[];
  promptAnswer: string;
  birth_date: string;
  meet_genders: string[];
  intent_goals: string[];
  showAge: boolean;
  showZodiac: boolean;
  showOrientation: boolean;
}

export async function saveOnboardingProfile(userId: string, payload: OnboardingProfilePayload): Promise<void> {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: payload.displayName,
      city: payload.city,
      occupation: payload.occupation,
      bio: payload.bio,
      relationship_goal: payload.relationshipGoal,
      mbti: payload.mbti,
      zodiac: payload.zodiac,
      interests: payload.interests,
      prompts: payload.promptAnswer
        ? [{ prompt: '周末最想和另一个人一起做什么？', answer: payload.promptAnswer }]
        : [],
      profile_status: 'REVIEWING',
    });
  if (profileError) throw profileError;

  const { error: preferencesError } = await supabase
    .from('profile_preferences')
    .upsert({
      id: userId,
      birth_date: payload.birth_date,
      desired_genders: payload.meet_genders,
      accepted_relationship_goals: payload.intent_goals,
      candidate_preferences: {},
      show_age: payload.showAge,
      show_zodiac: payload.showZodiac,
      show_orientation: payload.showOrientation,
    });
  if (preferencesError) throw preferencesError;
}

export interface ProfileEditPayload {
  displayName: string;
  city: string;
  occupation: string;
  bio: string;
  relationshipGoal: RelationshipGoal;
  mbti: string;
  interests: string[];
  promptAnswer: string;
  showAge: boolean;
  showZodiac: boolean;
  showOrientation: boolean;
}

/** Edit the public profile fields + privacy toggles. Never touches photos, verification or profile_status. */
export async function saveProfileEdit(userId: string, payload: ProfileEditPayload): Promise<void> {
  const { data: preferences } = await supabase
    .from('profile_preferences')
    .select('birth_date')
    .eq('id', userId)
    .maybeSingle();
  const birth = preferences?.birth_date ?? null;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      display_name: payload.displayName.trim(),
      city: payload.city.trim(),
      occupation: payload.occupation.trim(),
      bio: payload.bio.trim(),
      relationship_goal: payload.relationshipGoal,
      mbti: payload.mbti,
      zodiac: birth ? (zodiacFromBirthDate(birth) ?? '') : '',
      interests: payload.interests,
      prompts: payload.promptAnswer.trim()
        ? [{ prompt: '周末最想和另一个人一起做什么？', answer: payload.promptAnswer.trim() }]
        : [],
    })
    .eq('id', userId);
  if (profileError) throw profileError;

  const { error: preferencesError } = await supabase
    .from('profile_preferences')
    .update({
      show_age: payload.showAge,
      show_zodiac: payload.showZodiac,
      show_orientation: payload.showOrientation,
    })
    .eq('id', userId);
  if (preferencesError) throw preferencesError;
}
