import {
  FeedCardType,
  type ActivityFeedCard,
  type FeedCard,
  type PersonFeedCard,
  type TopicFeedCard,
} from './domain';

export const RECOMMENDATION_PAGE_SIZE = 10;

export const RECOMMENDATION_PAGE_QUOTA = {
  [FeedCardType.PERSON]: 4,
  [FeedCardType.ACTIVITY]: 3,
  [FeedCardType.TOPIC]: 3,
} as const;

export interface RecommendationCardPools {
  readonly people: readonly PersonFeedCard[];
  readonly activities: readonly ActivityFeedCard[];
  readonly topics: readonly TopicFeedCard[];
}

type RandomSource = () => number;
type PoolKey = keyof RecommendationCardPools;

const poolOrder = ['people', 'activities', 'topics'] as const satisfies readonly PoolKey[];

const quotaByPool: Readonly<Record<PoolKey, number>> = {
  people: RECOMMENDATION_PAGE_QUOTA[FeedCardType.PERSON],
  activities: RECOMMENDATION_PAGE_QUOTA[FeedCardType.ACTIVITY],
  topics: RECOMMENDATION_PAGE_QUOTA[FeedCardType.TOPIC],
};

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const sample = random();
    const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.9999999999999999) : 0;
    const candidate = Math.floor(normalized * (index + 1));
    const swapIndex = Math.max(0, Math.min(index, candidate));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Small deterministic PRNG for stable tests and session-scoped recommendation order. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Builds one finite, duplicate-free recommendation deck from every supplied card.
 * Each full page takes 4 people, 3 activities, and 3 topics while those pools can
 * satisfy the quota. Once a smaller pool is exhausted, remaining cards fill the
 * open slots so every original card is eventually shown exactly once.
 */
export function createRecommendationFeed(
  pools: RecommendationCardPools,
  random: RandomSource = Math.random,
): FeedCard[] {
  const queues: Record<PoolKey, FeedCard[]> = {
    people: shuffled(pools.people, random),
    activities: shuffled(pools.activities, random),
    topics: shuffled(pools.topics, random),
  };
  const result: FeedCard[] = [];

  while (poolOrder.some((key) => queues[key].length > 0)) {
    const page: FeedCard[] = [];

    poolOrder.forEach((key) => {
      page.push(...queues[key].splice(0, quotaByPool[key]));
    });

    while (page.length < RECOMMENDATION_PAGE_SIZE) {
      const available = poolOrder.filter((key) => queues[key].length > 0);
      if (!available.length) break;
      const sample = random();
      const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.9999999999999999) : 0;
      const selected = available[Math.floor(normalized * available.length)] ?? available[0];
      const card = queues[selected].shift();
      if (card) page.push(card);
    }

    shuffled(page, random).forEach((card) => {
      result.push({ ...card, rankPosition: result.length + 1 });
    });
  }

  return result;
}
