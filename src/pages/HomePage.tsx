import { Plus } from 'lucide-react';
import { useEffect } from 'react';
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
  topics: [
    { value: 'hot', label: '热门' },
    { value: 'find-company', label: '找同行' },
    { value: 'relationship', label: '认真关系' },
    { value: 'lifestyle', label: '生活方式' },
    { value: 'safety', label: '安全经验' },
  ],
} as const satisfies Readonly<Record<HomePrimary, readonly TabOption<HomeSecondary>[]>>;

const leadByPrimary: Readonly<Record<HomePrimary, { title: string; description: string }>> = {
  recommend: { title: '今天，想遇见什么？', description: '人物、活动机会与真实讨论，按推荐顺序呈现' },
  activities: { title: '加入一场真实活动', description: '只展示已经发布、可查看详情的活动' },
  topics: { title: '从一个问题开始认识彼此', description: '表达观点，再决定是否加入讨论' },
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

    if (secondary === 'find-company') {
      return entity.tags.some((tag) => tag.includes('同行'));
    }
    if (secondary === 'relationship') return entity.kind === TopicKind.RELATIONSHIP_SCENARIO;
    if (secondary === 'lifestyle') return entity.kind === TopicKind.LIFESTYLE_PROMPT;
    if (secondary === 'safety') return entity.tags.some((tag) => tag.includes('安全'));
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
  const visibleCards = cardsForRoute(primary, secondary, cardActions);
  const lead = leadByPrimary[primary];
  useEffect(() => { localStorage.setItem('4u:rfc:home-secondary:' + primary, secondary); }, [primary, secondary]);

  const navigatePrimary = (nextPrimary: HomePrimary) => {
    if (nextPrimary === primary) { window.scrollTo({ top: 0, behavior: 'smooth' }); onRetry(); return; }
    const remembered = localStorage.getItem('4u:rfc:home-secondary:' + nextPrimary) as HomeSecondary | null;
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
    <div className="page home-page screen-enter">
      <MobileBrandBar onSearch={onSearch} onMessages={onNotifications} />
      <header className="channel-header">
        <TabBar
          label="首页内容频道"
          options={primaryTabs}
          value={primary}
          onChange={navigatePrimary}
          className="primary-tabs"
        />
        <TabBar
          label={`${primaryTabs.find((tab) => tab.value === primary)?.label ?? '推荐'}筛选`}
          options={secondaryTabs[primary]}
          value={secondary}
          onChange={navigateSecondary}
          className="secondary-tabs"
        />
      </header>

      <div className="page-content">
        <div className="feed-lead">
          <div><h1>{lead.title}</h1><p>{lead.description}</p></div>
          {!loading && !error && !empty && <small>{visibleCards.length} 条</small>}
        </div>

        <MasonryFeed className="feed-grid" label="首页内容流">
          {loading ? skeletonKinds(primary).map((kind, index) => (
            <FeedSkeleton key={`${kind}-${index}`} kind={kind} />
          )) : error ? (
            <ErrorState onRetry={onRetry} />
          ) : empty || visibleCards.length === 0 ? (
            <EmptyState
              title="这一筛选暂时没有内容"
              description="可以清除筛选继续看看，或发起一场你真正想参与的活动。"
              actions={<>
                <button type="button" className="secondary-button" onClick={clearFilter}>清除筛选</button>
                <button type="button" className="primary-button" onClick={onCreate}>发起活动</button>
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
        {!loading && !error && !empty && visibleCards.length > 0 && <EndOfFeed />}
      </div>

      <button type="button" className="floating-create" onClick={onCreate}>
        <Plus size={18} /><span>发起</span>
      </button>
    </div>
  );
}
