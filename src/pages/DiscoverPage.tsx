import { ContentCard, type CardActions } from '../components/ContentCard';
import { PageHeader } from '../components/PageHeader';
import { MasonryFeed } from '../components/MasonryFeed';
import { EmptyState, EndOfFeed, ErrorState, FeedSkeleton } from '../components/StatusUI';
import { TabBar, type TabOption } from '../components/TabBar';
import {
  FeedCardType,
  RelationshipGoal,
  type FeedCard,
  type Person,
  type PersonFeedCard,
} from '../domain';
import { currentUser, homeFeed, people } from '../mockData';
import { canonicalPath, type DiscoverSegment } from '../router';

const segmentTabs = [
  { value: 'for-you', label: '为你' },
  { value: 'nearby', label: '附近' },
  { value: 'new', label: '新加入' },
  { value: 'serious', label: '认真关系' },
] as const satisfies readonly TabOption<DiscoverSegment>[];

const personTemplates = (homeFeed as readonly FeedCard[]).filter(
  (card): card is PersonFeedCard => card.cardType === FeedCardType.PERSON,
);

const relationshipGoalLabel = (person: Person) => {
  if (person.relationshipGoal === RelationshipGoal.LONG_TERM) return '长期关系';
  if (person.relationshipGoal === RelationshipGoal.SERIOUS_DATING) return '认真了解';
  return '从相处开始探索';
};

const defaultPersonCards: readonly PersonFeedCard[] = people.flatMap<PersonFeedCard>((person, index) => {
  const template = personTemplates[index % personTemplates.length];
  if (!template) return [];

  return [{
    ...template,
    cardId: `feed_discover_${person.id.slice('person_'.length)}`,
    entityId: person.id,
    entityVersion: person.entityVersion,
    requestId: 'request_discover_20260822_a1',
    rankPosition: index + 1,
    reason: {
      ...template.reason,
      headline: person.interests.length > 1
        ? `你们都关注${person.interests[0]}与${person.interests[1]}`
        : `你们都关注${person.interests[0]}`,
      explanation: '推荐只使用双方允许公开展示的资料；是否表达心动由你决定。',
      evidenceLabels: person.interests.slice(0, 2),
    },
    presentation: {
      ...template.presentation,
      image: person.photos[0],
      headline: `${person.displayName}，${person.age}`,
      supportingText: `${person.occupation} · ${person.city}`,
      badges: person.interests.slice(0, 2).map((label, badgeIndex) => ({
        label,
        tone: badgeIndex === 0 ? 'ACCENT' as const : 'NEUTRAL' as const,
      })),
      facts: [{ label: '想认识', value: relationshipGoalLabel(person) }],
      primaryActionLabel: '表达心动',
    },
  }];
});

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
  cards = defaultPersonCards,
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
      <PageHeader eyebrow="只发现真实个人" title="寻觅" />
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
