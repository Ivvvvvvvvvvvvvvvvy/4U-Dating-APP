import {
  FeedAction,
  FeedCardType,
  FeedPresentationTemplate,
  FeedReasonCode,
  PathType,
  type FeedCardId,
  type FeedRequestId,
  type ISODateTime,
  type Person,
  type PersonFeedCard,
  type PresentationBadge,
} from '../domain';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../integrations/supabase/types';
import { profileRowToPerson } from './profile';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface DiscoveryResult {
  readonly people: readonly Person[];
  readonly cards: readonly PersonFeedCard[];
}

const GOAL_LABELS: Readonly<Record<string, string>> = {
  LONG_TERM: '寻找长期关系',
  SERIOUS_DATING: '认真约会',
  OPEN_TO_EXPLORE: '开放探索',
};

/**
 * Load real users whose public profile is complete and has at least one
 * approved photo (photos jsonb non-empty). The viewer is excluded.
 */
export async function loadRecommendablePeople(excludeId?: string): Promise<DiscoveryResult> {
  const { data: rows } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_seeded', false)
    .order('created_at', { ascending: true });

  const eligible = (rows ?? []).filter((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (!row.display_name || !row.display_name.trim()) return false;
    return Array.isArray(row.photos) && row.photos.length > 0;
  });

  const people = eligible.map((row) => profileRowToPerson(row, undefined, row.display_age ?? 0));
  return { people, cards: people.map(buildUserFeedCard) };
}

/** Build a feed card matching the synthetic person card template. */
function buildUserFeedCard(person: Person): PersonFeedCard {
  const interests = person.interests.slice(0, 2);
  const now = Date.now();
  const suffix = person.id.slice('person_'.length).replaceAll('-', '').slice(0, 8);
  const badges: readonly PresentationBadge[] = interests.map((label, index) => ({
    label,
    tone: index === 0 ? 'ACCENT' : 'NEUTRAL',
  }));
  const headline = person.age > 0 ? `${person.displayName}，${person.age}` : person.displayName;
  const supportingText = [person.occupation, person.city].filter(Boolean).join(' · ');
  const expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString() as ISODateTime;

  return {
    schemaVersion: '1.0',
    cardId: `feed_user_${suffix}` as FeedCardId,
    cardType: FeedCardType.PERSON,
    pathType: PathType.PERSON,
    entityId: person.id,
    entityVersion: person.entityVersion,
    requestId: `request_user_people_${now}` as FeedRequestId,
    rankPosition: 0,
    reason: {
      code: FeedReasonCode.SHARED_INTEREST,
      headline: interests.length ? `可以从${interests[0]}聊起` : '先从认识开始',
      explanation: '推荐依据仅来自双方授权公开的资料。',
      evidenceLabels: interests,
    },
    expiresAt,
    presentation: {
      template: FeedPresentationTemplate.PERSON_PORTRAIT,
      image: person.photos[0],
      eyebrow: '资料完整',
      headline,
      supportingText,
      badges,
      facts: [{ label: '想认识', value: GOAL_LABELS[person.relationshipGoal] ?? '开放探索' }],
      primaryActionLabel: '表达红心',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.HEART_PERSON, FeedAction.HIDE, FeedAction.REPORT],
  };
}
