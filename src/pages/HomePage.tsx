import { Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../domain';
import { activityFeed, currentUser, homeFeed, topicFeed } from '../mockData';
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

const secondaryTabs = {
  recommend: [
    { value: 'for-you', label: '为你' },
    { value: 'nearby', label: '附近' },
    { value: 'weekend', label: '本周末' },
    { value: 'new', label: '新加入' },
  ],
  activities: [
    { value: 'all', label: '全部' },
    { value: 'weekend', label: '本周末' },
    { value: 'duo', label: '双人同行' },
    { value: 'group', label: '多人小组' },
    { value: 'exhibition', label: '展览' },
    { value: 'movie', label: '电影' },
    { value: 'sport', label: '运动' },
  ],
  topics: [{ value: 'hot', label: '全部话题' }],
} as const satisfies Readonly<Record<HomePrimary, readonly TabOption<HomeSecondary>[]>>;

const leadByPrimary: Readonly<Record<HomePrimary, { title: string; description: string }>> = {
  recommend: { title: '今天，想遇见什么？', description: '人物、活动机会与真实讨论，按推荐顺序呈现' },
  activities: { title: '加入一场真实活动', description: '只展示已经发布、可查看详情的活动' },
  topics: { title: '先聊话题，再决定是否认识', description: '关系议题负责表达观点，生活兴趣负责观察真实互动' },
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
): FeedCard[] {
  if (primary === 'activities') return filterActivities(activityFeed, secondary, actions);
  if (primary === 'topics') return filterTopics(topicFeed, secondary, actions);
  return filterRecommendation(homeFeed, secondary, actions);
}

function skeletonKinds(primary: HomePrimary): readonly ('activity' | 'person' | 'topic')[] {
  if (primary === 'activities') return ['activity', 'activity', 'activity', 'activity'];
  if (primary === 'topics') return ['topic', 'topic', 'topic', 'topic'];
  return ['activity', 'person', 'topic', 'activity', 'activity', 'person'];
}

const TOPIC_POOL_SIZE = 50;

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
  onRetry,
  onNavigate,
  onSearch,
  onNotifications,
  onCreate,
}: HomePageProps) {
  const [mixedTopicCards, setMixedTopicCards] = useState<FeedCard[]>(() => generateMixedTopicCards(TOPIC_POOL_SIZE));
  const [loadingMoreTopics, setLoadingMoreTopics] = useState(false);
  const loadingMoreRef = useRef(false);
  const topicSentinelRef = useRef<HTMLDivElement>(null);
  const isTopicFeed = primary === 'topics';
  const visibleCards = isTopicFeed ? mixedTopicCards : cardsForRoute(primary, secondary, cardActions);
  const lead = leadByPrimary[primary];
  useEffect(() => { localStorage.setItem('4u:rfc:home-secondary:' + primary, secondary); }, [primary, secondary]);

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

  const navigatePrimary = (nextPrimary: HomePrimary) => {
    if (nextPrimary === primary) { window.scrollTo({ top: 0, behavior: 'smooth' }); onRetry(); return; }
    const remembered = nextPrimary === 'topics' ? 'hot' : localStorage.getItem('4u:rfc:home-secondary:' + nextPrimary) as HomeSecondary | null;
    onNavigate(canonicalPath({
      kind: 'home',
      primary: nextPrimary,
      secondary: remembered ?? homeDefaults[nextPrimary],
    }));
  };

  const navigateSecondary = (nextSecondary: HomeSecondary) => {
    onNavigate(canonicalPath({ kind: 'home', primary, secondary: nextSecondary }));
  };

  const clearFilter = () => {
    onNavigate(canonicalPath({ kind: 'home', primary, secondary: homeDefaults[primary] }));
  };

  return (
    <div className="page home-page screen-enter" data-screen-label="首页内容流">
      <MobileBrandBar onSearch={onSearch} onMessages={onNotifications} />
      <header className="channel-header">
        <TabBar
          label="首页内容频道"
          options={primaryTabs}
          value={primary}
          onChange={navigatePrimary}
          className="primary-tabs"
        />
        {primary !== 'topics' && <TabBar
          label={`${primaryTabs.find((tab) => tab.value === primary)?.label ?? '推荐'}筛选`}
          options={secondaryTabs[primary]}
          value={secondary}
          onChange={navigateSecondary}
          className="secondary-tabs"
        />}
      </header>

      <div className="page-content">
        <div className="feed-lead">
          <div><h1>{lead.title}</h1><p>{lead.description}</p></div>
          {!loading && !error && !empty && <small>{isTopicFeed ? '持续更新' : `${visibleCards.length} 条`}</small>}
        </div>

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
                <ContentCard key={card.cardId} card={card} actions={cardActions} />
              ))}
            </>
          )}
        </MasonryFeed>
        {!loading && !error && !empty && visibleCards.length > 0 && (isTopicFeed
          ? <div ref={topicSentinelRef} className="topic-feed-sentinel" role="status"><span>{loadingMoreTopics ? '正在加载更多话题…' : '继续下滑，发现更多话题'}</span></div>
          : <EndOfFeed />)}
      </div>

      <button type="button" className="floating-create" onClick={onCreate}>
        <Plus size={18} /><span>发起</span>
      </button>
    </div>
  );
}
