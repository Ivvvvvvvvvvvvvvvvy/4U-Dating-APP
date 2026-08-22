import { Search, X } from 'lucide-react';
import { ActivityFormat, TopicKind, type Activity, type Person, type Topic } from '../domain';
import { EmptyState } from '../components/StatusUI';
import { SafeImage } from '../components/SafeImage';

export interface SearchPageProps {
  readonly query: string;
  readonly activities: readonly Activity[];
  readonly people: readonly Person[];
  readonly topics: readonly Topic[];
  readonly onQueryChange: (query: string) => void;
  readonly onOpenActivity: (activity: Activity) => void;
  readonly onOpenPerson: (person: Person) => void;
  readonly onOpenTopic: (topic: Topic) => void;
  readonly onBack: () => void;
}

const suggestions = ['看展', 'City Walk', '认真关系', '周末'];
const aliases: Readonly<Record<string, readonly string[]>> = {
  看展: ['展览', 'exhibition'],
  逛展: ['展览', 'exhibition'],
  散步: ['city walk', 'city_walk', '步行'],
  攀岩: ['抱石', 'sport'],
  约会: ['关系', 'relationship'],
};

export function SearchPage({
  query,
  activities,
  people,
  topics,
  onQueryChange,
  onOpenActivity,
  onOpenPerson,
  onOpenTopic,
  onBack,
}: SearchPageProps) {
  const terms = searchTerms(query);
  const activityResults = activities.filter((activity) => matches(terms, [
    activity.title,
    activity.summary,
    activity.category,
    activity.format,
    activity.publicLocation.city,
    activity.publicLocation.district,
    activity.publicLocation.areaLabel,
    ...activity.atmosphereTags,
  ]));
  const peopleResults = people.filter((person) => matches(terms, [
    person.displayName,
    person.city,
    person.occupation,
    person.bio,
    person.relationshipGoal,
    person.mbti,
    ...person.interests,
  ]));
  const topicResults = topics.filter((topic) => matches(terms, [
    topic.title,
    topic.summary,
    topic.kind,
    ...topic.tags,
    ...(topic.kind === TopicKind.RELATIONSHIP_SCENARIO
      ? [topic.scenario, ...topic.positionOptions.map((option) => option.label)]
      : [topic.prompt, topic.openingQuestion]),
  ]));
  const resultCount = activityResults.length + peopleResults.length + topicResults.length;

  return (
    <section className="page search-layout screen-enter" aria-labelledby="search-title" data-screen-label="搜索">
      <header className="page-header">
        <button type="button" className="icon-button search-back" aria-label="关闭搜索" onClick={onBack}>←</button>
        <div><span>发现真实的人与活动</span><h1 id="search-title">搜索</h1></div>
        {query && <small>{resultCount} 个结果</small>}
      </header>

      <label className="search-box">
        <Search size={19} />
        <span className="sr-only">搜索活动、用户或话题</span>
        <input
          type="search"
          autoFocus
          value={query}
          placeholder="搜索活动、用户或话题"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query && <button type="button" className="icon-button search-clear" aria-label="清空搜索" onClick={() => onQueryChange('')}><X size={17} /></button>}
      </label>

      {!query.trim() && (
        <div className="search-suggestions" aria-label="搜索建议">
          <span>试试</span>
          {suggestions.map((term) => <button key={term} type="button" onClick={() => onQueryChange(term)}>{term}</button>)}
        </div>
      )}

      {query.trim() && resultCount === 0 ? (
        <EmptyState title="没有找到匹配结果" description="试试活动类型、地区、兴趣或话题关键词。" />
      ) : (
        <main className="search-groups" aria-live="polite">
          <SearchGroup title="活动" count={activityResults.length}>
            {activityResults.map((activity) => (
              <button key={activity.id} type="button" className="search-result" onClick={() => onOpenActivity(activity)}>
                <SafeImage src={activity.cover.url} alt="" ratio="1 / 1" fallbackLabel="活动" />
                <span><small>{activity.format === ActivityFormat.PAIR ? '双人同行' : '多人小组'} · {activity.publicLocation.district}</small><b>{activity.title}</b><em>{activity.summary}</em></span>
              </button>
            ))}
          </SearchGroup>

          <SearchGroup title="用户" count={peopleResults.length}>
            {peopleResults.map((person) => (
              <button key={person.id} type="button" className="search-result" onClick={() => onOpenPerson(person)}>
                <SafeImage src={person.photos[0].url} alt="" ratio="1 / 1" fallbackLabel="用户" />
                <span><small>{person.city} · {person.occupation}</small><b>{person.displayName}，{person.age}</b><em>{person.interests.slice(0, 3).join(' · ')}</em></span>
              </button>
            ))}
          </SearchGroup>

          <SearchGroup title="话题" count={topicResults.length}>
            {topicResults.map((topic) => (
              <button key={topic.id} type="button" className="search-result" onClick={() => onOpenTopic(topic)}>
                <SafeImage src={topic.cover.url} alt="" ratio="1 / 1" fallbackLabel="话题" />
                <span><small>{topic.tags.join(' · ')} · {topic.replyCount} 条讨论</small><b>{topic.title}</b><em>{topic.summary}</em></span>
              </button>
            ))}
          </SearchGroup>
        </main>
      )}
    </section>
  );
}

function SearchGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return <section className="search-group"><h2>{title}<small>{count}</small></h2><div>{children}</div></section>;
}

function searchTerms(query: string) {
  const normalized = normalize(query);
  if (!normalized) return [] as string[];
  return [normalized, ...(aliases[normalized] ?? [])].map(normalize);
}

function matches(terms: readonly string[], fields: readonly (string | number)[]) {
  if (!terms.length) return true;
  const haystack = normalize(fields.join(' '));
  return terms.some((term) => haystack.includes(term));
}

function normalize(value: string | number) {
  return String(value).trim().toLocaleLowerCase('zh-CN').replace(/[-_]/g, ' ');
}
