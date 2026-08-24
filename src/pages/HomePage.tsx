import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContentCard, type CardActions } from '../components/ContentCard';
import { MobileBrandBar } from '../components/Navigation';
import { MasonryFeed } from '../components/MasonryFeed';
import { EmptyState, EndOfFeed, ErrorState, FeedSkeleton } from '../components/StatusUI';
import { TabBar, type TabOption } from '../components/TabBar';
import {
  ActivityCategory,
  ActivityFormat,
  FeedCardType,
  FeedReasonCode,
  TopicKind,
  type FeedCard,
  type PersonFeedCard,
} from '../domain';
import { activityFeed, currentUser, personFeed, topicFeed } from '../mockData';
import { createRecommendationFeed, createSeededRandom, RECOMMENDATION_PAGE_SIZE } from '../recommendationFeed';
import { generateTopicBatch } from '../topicGenerator';
import {
  canonicalPath,
  homeDefaults,
  type HomePrimary,
  type HomeSecondary,
} from '../router';

const primaryTabs = [
  { value: 'recommend', label: '推荐' },
  { value: 'activities', label: '活动' },
  { value: 'topics', label: '话题' },
] as const satisfies readonly TabOption<HomePrimary>[];

const leadByPrimary: Readonly<Record<HomePrimary, { title: string; description: string }>> = {
  recommend: { title: '今天，想遇见什么？', description: '人物、活动与真实讨论，按推荐顺序呈现' },
  activities: { title: '加入一场真实活动', description: '只展示已经发布、可查看详情的活动' },
  topics: { title: '', description: '' },
};

const isWeekend = (startsAt: string) => {
  const date = new Date(`${startsAt.slice(0, 10)}T12:00:00Z`);
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
};

const includesWeekend = (card: FeedCard) =>
  [...card.reason.evidenceLabels, card.presentation.eyebrow, card.presentation.supportingText]
    .some((value) => value.includes('周末'));

function filterRecommendation(
  cards: readonly FeedCard[],
  secondary: HomeSecondary,
  actions: CardActions,
): FeedCard[] {
  if (secondary === 'for-you') return [...cards];

  return cards.filter((card) => {
    const entity = actions.resolveEntity(card);

    if (secondary === 'nearby') {
      if (card.reason.code === FeedReasonCode.NEARBY_AREA) return true;
      if (entity?.entityType === FeedCardType.PERSON) {
        return entity.city === currentUser.profile.city;
      }
      if (entity?.entityType === FeedCardType.ACTIVITY
        || entity?.entityType === FeedCardType.ACTIVITY_OPPORTUNITY) {
        return entity.publicLocation.city === currentUser.profile.city;
      }
      return false;
    }

    if (secondary === 'weekend') {
      if (entity?.entityType === FeedCardType.ACTIVITY) return isWeekend(entity.schedule.startsAt);
      return includesWeekend(card);
    }

    if (secondary === 'new') return card.cardType === FeedCardType.PERSON;
    return true;
  });
}

function filterActivities(
  cards: readonly FeedCard[],
  secondary: HomeSecondary,
  actions: CardActions,
): FeedCard[] {
  return cards.filter((card) => {
    if (card.cardType !== FeedCardType.ACTIVITY) return false;
    if (secondary === 'all') return true;

    const entity = actions.resolveEntity(card);
    if (entity?.entityType !== FeedCardType.ACTIVITY) return false;

    if (secondary === 'weekend') return isWeekend(entity.schedule.startsAt);
    if (secondary === 'duo') return entity.format === ActivityFormat.PAIR;
    if (secondary === 'group') return entity.format === ActivityFormat.GROUP;
    if (secondary === 'exhibition') return entity.category === ActivityCategory.EXHIBITION;
    if (secondary === 'movie') return entity.category === ActivityCategory.FILM;
    if (secondary === 'sport') return entity.category === ActivityCategory.SPORT;
    return false;
  });
}

function filterTopics(
  cards: readonly FeedCard[],
  secondary: HomeSecondary,
  actions: CardActions,
): FeedCard[] {
  return cards.filter((card) => {
    if (card.cardType !== FeedCardType.TOPIC) return false;
    if (secondary === 'hot') return true;

    const entity = actions.resolveEntity(card);
    if (entity?.entityType !== FeedCardType.TOPIC) return false;

    if (secondary === 'relationship') return entity.kind === TopicKind.RELATIONSHIP_SCENARIO;
    if (secondary === 'lifestyle') {
      return entity.kind === TopicKind.LIFESTYLE_PROMPT && !entity.tags.some((tag) => tag === '轻表达' || tag === '近况');
    }
    if (secondary === 'expression') {
      return entity.kind === TopicKind.LIFESTYLE_PROMPT && entity.tags.some((tag) => tag === '轻表达' || tag === '近况');
    }
    return false;
  });
}

function cardsForRoute(
  primary: HomePrimary,
  secondary: HomeSecondary,
  actions: CardActions,
  recommendationCards: readonly FeedCard[],
): FeedCard[] {
  if (primary === 'activities') return filterActivities(activityFeed, secondary, actions);
  if (primary === 'topics') return filterTopics(topicFeed, secondary, actions);
  return filterRecommendation(recommendationCards, secondary, actions);
}

function skeletonKinds(primary: HomePrimary): readonly ('activity' | 'person' | 'topic')[] {
  if (primary === 'activities') return ['activity', 'activity', 'activity', 'activity'];
  if (primary === 'topics') return ['topic', 'topic', 'topic', 'topic'];
  return ['person', 'activity', 'topic', 'person', 'activity', 'topic', 'person', 'activity', 'topic', 'person'];
}

const TOPIC_POOL_SIZE = 50;
const RECOMMENDATION_SEED_KEY = '4u:recommendation-seed';

function sessionRecommendationSeed(): number {
  try {
    const stored = sessionStorage.getItem(RECOMMENDATION_SEED_KEY);
    if (stored && /^\d+$/.test(stored)) return Number(stored) >>> 0;
  } catch {
    // Restricted browsers can disable storage; random ordering still works.
  }
  const seed = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
    : Math.floor(Math.random() * 0x100000000);
  try {
    sessionStorage.setItem(RECOMMENDATION_SEED_KEY, String(seed));
  } catch {
    // Keep the in-memory seed when storage is unavailable.
  }
  return seed;
}

function generateMixedTopicCards(perStream: number): FeedCard[] {
  const hot = generateTopicBatch('hot', perStream).cards;
  const lifestyle = generateTopicBatch('lifestyle', perStream).cards;
  const cards: FeedCard[] = [];
  for (let index = 0; index < perStream; index += 5) {
    const hotGroup = hot.slice(index, index + 5);
    const lifeGroup = lifestyle.slice(index, index + 5);
    const order = [hotGroup[0], lifeGroup[0], lifeGroup[1], hotGroup[1], hotGroup[2], lifeGroup[2], hotGroup[3], lifeGroup[3], lifeGroup[4], hotGroup[4]];
    order.forEach((card) => { if (card) cards.push(card); });
  }
  return cards;
}

export type HomePageProps = {
  primary: HomePrimary;
  secondary: HomeSecondary;
  cardActions: CardActions;
  loading?: boolean;
  error?: boolean | string;
  empty?: boolean;
  extraPersonFeedCards?: readonly PersonFeedCard[];
  onRetry: () => void;
  onNavigate: (path: string) => void;
  onSearch: () => void;
  onNotifications: () => void;
  onCreate: () => void;
};

export function HomePage({
  primary,
  secondary,
  cardActions,
  loading = false,
  error = false,
  empty = false,
  extraPersonFeedCards,
  onRetry,
  onNavigate,
  onSearch,
  onNotifications,
  onCreate,
}: HomePageProps) {
  const [recommendationSeed] = useState(sessionRecommendationSeed);
  const recommendationCards = useMemo(
    () => createRecommendationFeed(
      { people: [...personFeed, ...(extraPersonFeedCards ?? [])], activities: activityFeed, topics: topicFeed },
      createSeededRandom(recommendationSeed),
    ),
    [recommendationSeed, extraPersonFeedCards],
  );
  const recommendationRouteKey = `${primary}:${secondary}`;
  const [recommendationPage, setRecommendationPage] = useState({ key: recommendationRouteKey, count: RECOMMENDATION_PAGE_SIZE });
  const visibleRecommendationCount = recommendationPage.key === recommendationRouteKey
    ? recommendationPage.count
    : RECOMMENDATION_PAGE_SIZE;
  const [mixedTopicCards, setMixedTopicCards] = useState<FeedCard[]>(() => generateMixedTopicCards(TOPIC_POOL_SIZE));
  const [loadingMoreTopics, setLoadingMoreTopics] = useState(false);
  const loadingMoreRef = useRef(false);
  const loadingMoreRecommendationsRef = useRef(false);
  const previousTouchYRef = useRef<number | null>(null);
  const userScrollTowardEndRef = useRef(false);
  const topicSentinelRef = useRef<HTMLDivElement>(null);
  const recommendationSentinelRef = useRef<HTMLDivElement>(null);
  const isTopicFeed = primary === 'topics';
  const isRecommendationFeed = primary === 'recommend';
  const routeCards = cardsForRoute(primary, secondary, cardActions, recommendationCards);
  const visibleCards = isTopicFeed
    ? filterTopics(mixedTopicCards, secondary, cardActions)
    : isRecommendationFeed
      ? routeCards.slice(0, visibleRecommendationCount)
      : routeCards;
  const hasMoreRecommendations = isRecommendationFeed && visibleCards.length < routeCards.length;
  const lead = leadByPrimary[primary];
  const loadMoreRecommendations = useCallback(() => {
    if (loadingMoreRecommendationsRef.current) return;
    loadingMoreRecommendationsRef.current = true;
    setRecommendationPage((current) => ({
      key: recommendationRouteKey,
      count: Math.min(
        (current.key === recommendationRouteKey ? current.count : RECOMMENDATION_PAGE_SIZE) + RECOMMENDATION_PAGE_SIZE,
        routeCards.length,
      ),
    }));
  }, [recommendationRouteKey, routeCards.length]);

  useEffect(() => {
    loadingMoreRecommendationsRef.current = false;
  }, [visibleCards.length]);

  const loadMoreTopics = useCallback(() => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMoreTopics(true);
    window.setTimeout(() => {
      setMixedTopicCards((current) => [...current, ...generateMixedTopicCards(10)]);
      loadingMoreRef.current = false;
      setLoadingMoreTopics(false);
    }, 280);
  }, []);

  useEffect(() => {
    if (!isTopicFeed || !topicSentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreTopics();
    }, { rootMargin: '900px 0px' });
    observer.observe(topicSentinelRef.current);
    return () => observer.disconnect();
  }, [isTopicFeed, loadMoreTopics]);

  useEffect(() => {
    if (!hasMoreRecommendations) return;
    let frame: number | null = null;

    const checkDistanceToEnd = () => {
      frame = null;
      const sentinel = recommendationSentinelRef.current;
      if (!userScrollTowardEndRef.current || !sentinel) return;
      userScrollTowardEndRef.current = false;
      if (sentinel.getBoundingClientRect().top <= window.innerHeight + 240) {
        loadMoreRecommendations();
      }
    };

    const scheduleCheck = () => {
      if (frame === null) frame = window.requestAnimationFrame(checkDistanceToEnd);
    };
    const markWheelIntent = (event: WheelEvent) => {
      if (event.deltaY > 0) {
        userScrollTowardEndRef.current = true;
        scheduleCheck();
      }
    };
    const rememberTouch = (event: TouchEvent) => {
      previousTouchYRef.current = event.touches[0]?.clientY ?? null;
    };
    const markTouchIntent = (event: TouchEvent) => {
      const nextTouchY = event.touches[0]?.clientY;
      if (nextTouchY === undefined) return;
      if (previousTouchYRef.current !== null && nextTouchY < previousTouchYRef.current) {
        userScrollTowardEndRef.current = true;
        scheduleCheck();
      }
      previousTouchYRef.current = nextTouchY;
    };
    const clearTouch = () => { previousTouchYRef.current = null; };
    const markKeyboardIntent = (event: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) {
        userScrollTowardEndRef.current = true;
        scheduleCheck();
      }
    };

    window.addEventListener('wheel', markWheelIntent, { passive: true });
    window.addEventListener('touchstart', rememberTouch, { passive: true });
    window.addEventListener('touchmove', markTouchIntent, { passive: true });
    window.addEventListener('touchend', clearTouch, { passive: true });
    window.addEventListener('keydown', markKeyboardIntent);
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    return () => {
      window.removeEventListener('wheel', markWheelIntent);
      window.removeEventListener('touchstart', rememberTouch);
      window.removeEventListener('touchmove', markTouchIntent);
      window.removeEventListener('touchend', clearTouch);
      window.removeEventListener('keydown', markKeyboardIntent);
      window.removeEventListener('scroll', scheduleCheck);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [hasMoreRecommendations, loadMoreRecommendations]);

  const navigatePrimary = (nextPrimary: HomePrimary) => {
    const nextSecondary = homeDefaults[nextPrimary];
    if (nextPrimary === primary && secondary === nextSecondary) { window.scrollTo({ top: 0, behavior: 'smooth' }); onRetry(); return; }
    setRecommendationPage({ key: `${nextPrimary}:${nextSecondary}`, count: RECOMMENDATION_PAGE_SIZE });
    onNavigate(canonicalPath({
      kind: 'home',
      primary: nextPrimary,
      secondary: nextSecondary,
    }));
  };

  const clearFilter = () => {
    onNavigate(canonicalPath({ kind: 'home', primary, secondary: homeDefaults[primary] }));
  };

  return (
    <div className="page home-page screen-enter" data-screen-label="首页内容流">
      <MobileBrandBar onSearch={onSearch} onMessages={onNotifications} tabs={<TabBar
          label="首页内容频道"
          options={primaryTabs}
          value={primary}
          onChange={navigatePrimary}
          className="primary-tabs"
        />} />

      <div className="page-content">
        {primary !== 'topics' && <div className="feed-lead">
          <div><h1>{lead.title}</h1><p>{lead.description}</p></div>
          {!loading && !error && !empty && <small>{isTopicFeed ? '持续更新' : isRecommendationFeed ? `${visibleCards.length} / ${routeCards.length} 条` : `${visibleCards.length} 条`}</small>}
        </div>}

        <MasonryFeed className={'feed-grid' + (isTopicFeed ? ' topic-feed-grid' : '')} label="首页内容流">
          {loading ? skeletonKinds(primary).map((kind, index) => (
            <FeedSkeleton key={`${kind}-${index}`} kind={kind} />
          )) : error ? (
            <ErrorState onRetry={onRetry} />
          ) : empty || visibleCards.length === 0 ? (
            <EmptyState
              title="这一筛选暂时没有内容"
              description={primary === 'topics' ? '可以回到热门，看看关系议题或生活兴趣。' : '可以清除筛选继续看看，或发起一场你真正想参与的活动。'}
              actions={<>
                <button type="button" className="secondary-button" onClick={clearFilter}>清除筛选</button>
                {primary !== 'topics' && <button type="button" className="primary-button" onClick={onCreate}>发起活动</button>}
              </>}
            />
          ) : (
            <>
              {visibleCards.map((card) => (
                <ContentCard key={card.cardId} card={card} actions={cardActions} showCompatibility={primary === 'recommend'} />
              ))}
            </>
          )}
        </MasonryFeed>
        {!loading && !error && !empty && visibleCards.length > 0 && (isTopicFeed
          ? <div ref={topicSentinelRef} className="topic-feed-sentinel" role="status"><span>{loadingMoreTopics ? '正在加载更多话题…' : '继续下滑，发现更多话题'}</span></div>
          : hasMoreRecommendations
            ? <div ref={recommendationSentinelRef} className="recommendation-feed-sentinel" role="status"><span>继续上滑，发现更多推荐</span></div>
            : <EndOfFeed />)}
        {isRecommendationFeed && <p className="sr-only" aria-live="polite">已显示 {visibleCards.length} 条推荐，共 {routeCards.length} 条</p>}
      </div>

      <button type="button" className="floating-create" onClick={onCreate}>
        <Plus size={18} /><span>发起</span>
      </button>
    </div>
  );
}
