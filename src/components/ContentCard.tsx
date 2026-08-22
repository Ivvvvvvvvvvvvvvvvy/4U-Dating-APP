import { Bookmark, CalendarDays, CheckCircle2, Heart, MapPin, Sparkles, UsersRound } from 'lucide-react';
import { ActivityFulfillmentStatus, ActivityRecruitmentStatus, FeedAction, FeedCardType, TopicKind, VerificationStatus, type Activity, type ActivityOpportunity, type FeedCard, type Person, type Topic } from '../domain';
import { SafeImage } from './SafeImage';

export type CardActions = {
  savedActivities: Set<string>;
  heartedPeople: Set<string>;
  followedTopics: Set<string>;
  pendingKey?: string;
  onOpen: (card: FeedCard) => void;
  onSaveActivity: (activity: Activity) => void;
  onHeartPerson: (person: Person) => void;
  onFollowTopic: (topic: Topic) => void;
  onOpenActivity: (activity: Activity) => void;
  resolveEntity: (card: FeedCard) => Activity | ActivityOpportunity | Person | Topic | undefined;
};

function ActivityCard({ card, activity, actions }: { card: FeedCard; activity: Activity; actions: CardActions }) {
  const saved = actions.savedActivities.has(activity.id);
  const pending = actions.pendingKey === 'activity:' + activity.id;
  const remaining = activity.capacity.maximum - activity.capacity.confirmedCount - activity.capacity.heldCount;
  const status = activity.fulfillmentStatus === ActivityFulfillmentStatus.FORMED ? '已成行' : activity.recruitmentStatus === ActivityRecruitmentStatus.WAITLIST_ONLY ? '仅候补' : remaining <= 0 ? '已满员' : '剩 ' + remaining + ' 位';
  return (
    <article className="feed-card activity-card" data-card-type="ACTIVITY" data-card-id={card.cardId}>
      <button type="button" className="card-main-action" aria-label={'查看活动：' + activity.title} onClick={() => actions.onOpen(card)} />
      <div className="card-media activity-media">
        <SafeImage src={activity.cover.url} ratio={activity.cover.width + ' / ' + activity.cover.height} alt={activity.title} loading="lazy" fallbackLabel={activity.category} />
        <span className={'type-badge type-badge--' + activity.format.toLowerCase()}><UsersRound size={13}/>{activity.format === 'PAIR' ? '双人同行' : '多人小组'}</span>
        <span className="status-badge"><i/>{status}</span>
        {(card.allowedActions as readonly FeedAction[]).includes(FeedAction.SAVE) && <button type="button" className={'quick-action bookmark-action ' + (saved ? 'is-active' : '')} aria-label={saved ? '取消收藏活动' : '收藏活动'} aria-pressed={saved} disabled={pending} onClick={(event) => { event.stopPropagation(); actions.onSaveActivity(activity); }}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'}/></button>}
        <div className="resonance resonance--activity" aria-hidden="true"><i/><i/></div>
      </div>
      <div className="card-body">
        <p className="card-kicker">{activityCategory(activity)} · {activity.summary}</p>
        <h2>{activity.title}</h2>
        <div className="metadata"><span><CalendarDays size={13}/>{new Date(activity.schedule.startsAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',weekday:'short'})}</span><span><MapPin size={13}/>{activity.publicLocation.district}</span></div>
        <div className="participant-line"><div className="avatar-stack">{activity.visibleParticipants.slice(0,3).map((participant) => <span className="avatar-fallback" key={participant.personId}>{participant.role === 'ORGANIZER' ? '主' : '友'}</span>)}</div><span>{activity.capacity.confirmedCount}/{activity.capacity.maximum} · {status}</span></div>
        <div className="reason-line"><Sparkles size={13}/><span>{card.reason.explanation}</span></div>
      </div>
    </article>
  );
}

function PersonCard({ card, person, actions, compact = false }: { card: FeedCard; person: Person; actions: CardActions; compact?: boolean }) {
  const hearted = actions.heartedPeople.has(person.id);
  const pending = actions.pendingKey === 'person:' + person.id;
  return (
    <article className={'feed-card person-card ' + (compact ? 'person-card--compact' : '')} data-card-type="PERSON" data-card-id={card.cardId}>
      <button type="button" className="card-main-action" aria-label={'查看个人：' + person.displayName} onClick={() => actions.onOpen(card)} />
      <div className="card-media person-media">
        <SafeImage src={person.photos[0].url} ratio="4 / 5" alt={person.displayName} loading="lazy" fallbackLabel="个人照片" />
        <div className="person-overlay"><span>{person.verification.personhood === VerificationStatus.VERIFIED && <CheckCircle2 size={14}/>}真人认证</span><h2>{person.displayName}<small>{person.age}</small></h2><p>{person.city} · {relationshipLabel(person)}</p></div>
        {(card.allowedActions as readonly FeedAction[]).includes(FeedAction.HEART_PERSON) && <button type="button" className={'quick-action heart-action ' + (hearted ? 'is-active' : '')} aria-label={hearted ? '取消心动' : '心动'} aria-pressed={hearted} disabled={pending} onClick={(event) => { event.stopPropagation(); actions.onHeartPerson(person); }}><Heart size={19} fill={hearted ? 'currentColor' : 'none'}/></button>}
        <div className="resonance resonance--person" aria-hidden="true"><i/><i/></div>
      </div>
      <div className="card-body">
        <div className="person-clue"><Sparkles size={13}/><strong>{card.reason.headline}</strong></div>
        <p className="person-reason">{card.reason.explanation}</p>
        <div className="tag-row">{person.interests.slice(0,3).map((tag) => <span key={tag}>{tag}</span>)}</div>
        {!compact && <div className="activity-anchor"><span>关系线索</span><strong>{person.occupation}</strong></div>}
      </div>
    </article>
  );
}

function TopicCard({ card, topic, actions }: { card: FeedCard; topic: Topic; actions: CardActions }) {
  const streamClass = topic.tags.includes('AI 热点') ? ' topic-card--ai-hot' : topic.tags.includes('AI 生活') ? ' topic-card--ai-life' : '';
  return (
    <article className={'feed-card topic-card' + streamClass} data-card-type="TOPIC" data-card-id={card.cardId}>
      <button type="button" className="card-main-action" aria-label={'查看话题：' + topic.title} onClick={() => actions.onOpen(card)} />
      <div className="topic-pulse" aria-hidden="true"><i/><i/><i/></div>
      <h2 className="card-title-action" onClick={() => actions.onOpen(card)}>{topic.title}</h2>
      <p>{topic.kind === TopicKind.RELATIONSHIP_SCENARIO ? topic.scenario : topic.prompt}</p>
      <footer>
        <span>{topic.replyCount} 人在聊</span>
        <time>{topic.tags[1] ?? topic.tags[0]}</time>
      </footer>
    </article>
  );
}

function OpportunityCard({ card, activity, actions }: { card: FeedCard; activity: ActivityOpportunity; actions: CardActions }) {
  return <article className="feed-card opportunity-card" data-card-type="ACTIVITY_OPPORTUNITY" data-card-id={card.cardId}><button type="button" className="card-main-action" aria-label={'查看活动灵感：' + activity.title} onClick={() => actions.onOpen(card)} /><span>活动灵感 · {activity.authorizedInterestCount} 人公开感兴趣</span><Sparkles size={28}/><h2>{activity.title}</h2><p>{card.reason.explanation}</p><b>查看灵感 →</b></article>;
}

export function ContentCard({ card, actions, compactPerson = false }: { card: FeedCard; actions: CardActions; compactPerson?: boolean }) {
  const entity = actions.resolveEntity(card);
  if (card.cardType === FeedCardType.ACTIVITY && entity?.entityType === FeedCardType.ACTIVITY) return <ActivityCard card={card} activity={entity} actions={actions}/>;
  if (card.cardType === FeedCardType.PERSON && entity?.entityType === FeedCardType.PERSON) return <PersonCard card={card} person={entity} actions={actions} compact={compactPerson}/>;
  if (card.cardType === FeedCardType.TOPIC && entity?.entityType === FeedCardType.TOPIC) return <TopicCard card={card} topic={entity} actions={actions}/>;
  if (card.cardType === FeedCardType.ACTIVITY_OPPORTUNITY && entity?.entityType === FeedCardType.ACTIVITY_OPPORTUNITY) return <OpportunityCard card={card} activity={entity} actions={actions}/>;
  return <article className="feed-card unknown-card" role="status"><b>暂不支持的内容类型</b><p>请刷新后重试；当前内容已安全隐藏。</p></article>;
}

function relationshipLabel(person: Person) {
  if (person.relationshipGoal === 'LONG_TERM') return '期待长期关系';
  if (person.relationshipGoal === 'SERIOUS_DATING') return '认真了解';
  return '从相处开始探索';
}

function activityCategory(activity: Activity) {
  const labels: Record<string, string> = { EXHIBITION: '展览', CITY_WALK: '散步', SPORT: '运动', MUSIC: '音乐', FILM: '电影', FOOD: '美食', CRAFT: '手作', OUTDOOR: '户外' };
  return labels[activity.category] ?? activity.category;
}
