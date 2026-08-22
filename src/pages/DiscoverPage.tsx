import { ContentCard, type CardActions } from '../components/ContentCard';
import { PageHeader } from '../components/PageHeader';
import { MasonryFeed } from '../components/MasonryFeed';
import { EmptyState, EndOfFeed, ErrorState, FeedSkeleton } from '../components/StatusUI';
import { TabBar, type TabOption } from '../components/TabBar';
import {
  FeedCardType,
  RelationshipGoal,
  type PersonFeedCard,
} from '../domain';
import { currentUser, personFeed } from '../mockData';
import { canonicalPath, type DiscoverSegment } from '../router';

const segmentTabs = [
  { value: 'for-you', label: '为你' },
  { value: 'nearby', label: '附近' },
  { value: 'new', label: '新加入' },
  { value: 'serious', label: '认真关系' },
] as const satisfies readonly TabOption<DiscoverSegment>[];

function cardsForSegment(
  cards: readonly PersonFeedCard[],
  segment: DiscoverSegment,
  actions: CardActions,
): PersonFeedCard[] {
  if (segment === 'for-you' || segment === 'new') return [...cards];

  return cards.filter((card) => {
    const entity = actions.resolveEntity(card);
    if (entity?.entityType !== FeedCardType.PERSON) return false;
    if (segment === 'nearby') return entity.city === currentUser.profile.city;
    return entity.relationshipGoal === RelationshipGoal.LONG_TERM
      || entity.relationshipGoal === RelationshipGoal.SERIOUS_DATING;
  });
}

export type DiscoverPageProps = {
  segment: DiscoverSegment;
  cards?: readonly PersonFeedCard[];
  cardActions: CardActions;
  loading?: boolean;
  error?: boolean | string;
  empty?: boolean;
  onRetry: () => void;
  onNavigate: (path: string) => void;
};

export function DiscoverPage({
  segment,
  cards = personFeed,
  cardActions,
  loading = false,
  error = false,
  empty = false,
  onRetry,
  onNavigate,
}: DiscoverPageProps) {
  const visibleCards = cardsForSegment(cards, segment, cardActions);

  const navigateSegment = (nextSegment: DiscoverSegment) => {
    onNavigate(canonicalPath({ kind: 'discover', segment: nextSegment }));
  };

  const clearFilters = () => navigateSegment('for-you');
  const goHome = () => onNavigate(canonicalPath({
    kind: 'home',
    primary: 'recommend',
    secondary: 'for-you',
  }));

  return (
    <div className="page discover-page screen-enter" data-screen-label="寻觅">
      <PageHeader eyebrow="200 份虚构演示档案" title="寻觅" />
      <TabBar
        label="寻觅筛选"
        options={segmentTabs}
        value={segment}
        onChange={navigateSegment}
        className="filter-tabs"
      />

      <div className="page-content">
        <div className="feed-lead">
          <div>
            <h1>发现值得认真认识的人</h1>
            <p>心动独立表达；只有彼此心动，才会开启对话</p>
          </div>
          {!loading && !error && !empty && <small>{visibleCards.length} 人</small>}
        </div>

        <MasonryFeed className="feed-grid discover-grid" label="个人推荐">
          {loading ? Array.from({ length: 6 }, (_, index) => (
            <FeedSkeleton key={index} kind="person" />
          )) : error ? (
            <ErrorState onRetry={onRetry} />
          ) : empty || visibleCards.length === 0 ? (
            <EmptyState
              title="暂时没有符合条件的人"
              description="清除当前筛选，或者回首页看看今天的推荐。"
              actions={<>
                <button type="button" className="secondary-button" onClick={clearFilters}>清除筛选</button>
                <button type="button" className="primary-button" onClick={goHome}>去首页</button>
              </>}
            />
          ) : (
            <>
              {visibleCards.map((card) => (
                <ContentCard
                  key={card.cardId}
                  card={card}
                  actions={cardActions}
                  compactPerson
                />
              ))}
            </>
          )}
        </MasonryFeed>
        {!loading && !error && !empty && visibleCards.length > 0 && <EndOfFeed />}
      </div>
    </div>
  );
}
