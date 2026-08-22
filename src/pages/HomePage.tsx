import { Plus, RefreshCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { generateTopicBatch, type AiTopicStream, type GeneratedTopicBatch } from '../topicGenerator';
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
    { value: 'hot', label: 'AI 精选' },
    { value: 'relationship', label: '热点话题' },
    { value: 'lifestyle', label: '生活话题' },
    { value: 'expression', label: '轻表达' },
  ],
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

type AiTopicMode = 'mixed' | AiTopicStream;
const TOPIC_POOL_SIZE = 50;

function cardsForAiMode(
  pools: Record<AiTopicStream, GeneratedTopicBatch>,
  cursors: Record<AiTopicMode, number>,
  mode: AiTopicMode,
): FeedCard[] {
  const cursor = cursors[mode];
  if (mode === 'hot') return pools.hot.cards.slice(cursor, cursor + 10);
  if (mode === 'lifestyle') return pools.lifestyle.cards.slice(cursor, cursor + 10);
  const hot = pools.hot.cards.slice(cursor, cursor + 5);
  const lifestyle = pools.lifestyle.cards.slice(cursor, cursor + 5);
  return hot.flatMap((card, index) => lifestyle[index] ? [card, lifestyle[index]] : [card]);
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
  const [generatedPools, setGeneratedPools] = useState<Record<AiTopicStream, GeneratedTopicBatch>>(() => ({
    hot: generateTopicBatch('hot', TOPIC_POOL_SIZE),
    lifestyle: generateTopicBatch('lifestyle', TOPIC_POOL_SIZE),
  }));
  const [topicCursors, setTopicCursors] = useState<Record<AiTopicMode, number>>({ mixed: 0, hot: 0, lifestyle: 0 });
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const aiMode: AiTopicMode = secondary === 'hot' ? 'mixed' : secondary === 'relationship' ? 'hot' : 'lifestyle';
  const isAiTopicStream = primary === 'topics' && (secondary === 'hot' || secondary === 'relationship' || secondary === 'lifestyle');
  const visibleCards = isAiTopicStream ? cardsForAiMode(generatedPools, topicCursors, aiMode) : cardsForRoute(primary, secondary, cardActions);
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

  const refreshAiTopics = () => {
    if (aiRefreshing) return;
    setAiRefreshing(true);
    window.setTimeout(() => {
      const step = aiMode === 'mixed' ? 5 : 10;
      const poolLength = aiMode === 'mixed'
        ? Math.min(generatedPools.hot.cards.length, generatedPools.lifestyle.cards.length)
        : generatedPools[aiMode].cards.length;
      const nextCursor = topicCursors[aiMode] + step;
      if (nextCursor + step <= poolLength) {
        setTopicCursors((current) => ({ ...current, [aiMode]: nextCursor }));
      } else {
        setGeneratedPools((current) => aiMode === 'mixed'
          ? { hot: generateTopicBatch('hot', TOPIC_POOL_SIZE), lifestyle: generateTopicBatch('lifestyle', TOPIC_POOL_SIZE) }
          : { ...current, [aiMode]: generateTopicBatch(aiMode, TOPIC_POOL_SIZE) });
        setTopicCursors((current) => ({ ...current, [aiMode]: 0 }));
      }
      setAiRefreshing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 420);
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
          {isAiTopicStream ? (
            <div className={'ai-topic-controls ai-topic-controls--' + aiMode}>
              <span><Sparkles size={13}/>{aiMode === 'mixed' ? '热点 5 · 生活 5' : aiMode === 'hot' ? 'AI 热点 · 50+' : 'AI 生活 · 50+'}</span>
              <button type="button" onClick={refreshAiTopics} disabled={aiRefreshing}>
                <RefreshCcw size={14} className={aiRefreshing ? 'is-spinning' : ''}/>
                {aiRefreshing ? '生成中…' : 'AI 换一批'}
              </button>
            </div>
          ) : !loading && !error && !empty && <small>{visibleCards.length} 条</small>}
        </div>

        <MasonryFeed className="feed-grid" label="首页内容流">
          {loading || aiRefreshing ? skeletonKinds(primary).map((kind, index) => (
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
        {!loading && !aiRefreshing && !error && !empty && visibleCards.length > 0 && (
          isAiTopicStream ? (
            <div className={'ai-topic-more ai-topic-more--' + aiMode}>
              <span>{aiMode === 'mixed' ? '热点与生活 1:1 · 每类题库 50+' : '当前 10 个 · 题库 50+'}</span>
              <button type="button" onClick={refreshAiTopics}><RefreshCcw size={15}/>继续换一批</button>
            </div>
          ) : <EndOfFeed />
        )}
      </div>

      <button type="button" className="floating-create" onClick={onCreate}>
        <Plus size={18} /><span>发起</span>
      </button>
    </div>
  );
}
