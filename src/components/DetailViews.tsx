import { ArrowLeft, Bookmark, CalendarDays, CheckCircle2, Flag, Heart, LockKeyhole, MapPin, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { ActivityFormat, ActivityRecruitmentStatus, RelationshipGoal, VerificationStatus, type Activity, type ActivityOpportunity, type Person } from '../domain';
import { findPersonById } from '../mockData';
import { useDetailFocus } from './detailFocus';
import { SafeImage } from './SafeImage';

function DetailTop({ label, onBack, trailing }: { label: string; onBack: () => void; trailing?: React.ReactNode }) {
  return <header className="detail-top"><button className="icon-button" onClick={onBack} aria-label="返回"><ArrowLeft/></button><span>{label}</span><div>{trailing}</div></header>;
}

export function ActivityDetail({ activity, saved, joining, joined, canJoin, onBack, onSave, onJoin }: { activity: Activity; saved: boolean; joining: boolean; joined: boolean; canJoin: boolean; onBack: () => void; onSave: () => void; onJoin: () => void }) {
  useDetailFocus('activity-detail-title');
  const isDuo = activity.format === ActivityFormat.PAIR;
  const remaining = activity.capacity.maximum - activity.capacity.confirmedCount - activity.capacity.heldCount;
  const cta = joined ? '查看申请' : !canJoin ? '当前不可申请' : activity.recruitmentStatus === ActivityRecruitmentStatus.WAITLIST_ONLY || remaining <= 0 ? '加入候补' : isDuo ? '申请同行' : '申请参加';
  return <article className="detail-page detail-page--activity" aria-labelledby="activity-detail-title" data-screen-label="活动详情">
    <DetailTop label="活动详情" onBack={onBack} trailing={<button className={'icon-button ' + (saved ? 'is-active' : '')} aria-label={saved ? '取消收藏活动' : '收藏活动'} aria-pressed={saved} onClick={onSave}><Bookmark fill={saved ? 'currentColor' : 'none'}/></button>}/>
    <div className="detail-cover"><SafeImage src={activity.cover.url} alt={activity.title} ratio="16 / 10"/><div className="detail-cover__shade"/><div className="detail-cover__copy"><span>{activityCategory(activity)} · {isDuo ? '双人同行' : '多人小组'}</span><h1 id="activity-detail-title" tabIndex={-1}>{activity.title}</h1><p>{activity.summary}</p></div></div>
    <div className="detail-body">
      <div className="detail-facts"><span><CalendarDays/ ><b>{dateLabel(activity)}</b><small>{timeLabel(activity)} · {durationLabel(activity)}</small></span><span><MapPin/><b>{activity.publicLocation.areaLabel}</b><small>{activity.publicLocation.city} · 成行后显示集合点</small></span><span><UsersRound/><b>{activity.capacity.confirmedCount}/{activity.capacity.maximum} 已确认</b><small>最少 {activity.capacity.minimum} 人 · 申请需实时确认</small></span></div>
      <section className="insight-panel"><span><Sparkles size={16}/>为什么推荐</span><h2>活动节奏与你的公开兴趣相符</h2><p>{activity.summary}</p><small>来自你已授权用于解释的共同兴趣；不展示内部匹配分或他人意愿。</small></section>
      <section className="detail-section"><div className="section-title"><h2>一起去的人</h2><span>仅已确认并授权公开</span></div><div className="people-strip">{activity.visibleParticipants.map((participant) => { const person = findPersonById(participant.personId); return <div key={participant.personId}>{person ? <SafeImage src={person.photos[0].url} alt={person.displayName} ratio="1"/> : <span className="avatar-fallback">友</span>}<b>{person?.displayName ?? '已确认成员'}</b><span>{participant.role === 'ORGANIZER' ? '发起者' : '已确认'}</span></div>; })}</div></section>
      <section className="detail-section"><h2>活动安排</h2><div className="timeline">{activity.agenda.map((item, index) => <div key={item}><i>{String(index + 1).padStart(2,'0')}</i><span>{item}</span></div>)}</div></section>
      <section className="detail-section"><h2>成行与候补</h2><p>申请本身不占座；收到席位并确认后才计入人数。满员后按候补顺序处理。</p><div className="detail-tags">{activity.atmosphereTags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>
      <section className="safety-panel"><ShieldCheck/><div><h2>安全与边界</h2><p>{activity.safetyNotice}</p><button type="button"><Flag size={14}/>举报活动</button></div></section>
    </div>
    <footer className="sticky-action"><div><strong>{activity.price?.display ?? '免费'}</strong><span>预计人均</span></div><button className="primary-button" disabled={joining || (!canJoin && !joined)} onClick={onJoin}>{joining ? '正在确认最新状态…' : cta}</button></footer>
  </article>;
}

export function PersonDetail({ person, suggestedActivity, hearted, hearting, onBack, onHeart, onOpenActivity }: { person: Person; suggestedActivity: Activity; hearted: boolean; hearting: boolean; onBack: () => void; onHeart: () => void; onOpenActivity: (activity: Activity) => void }) {
  useDetailFocus('person-detail-title');
  return <article className="detail-page detail-page--person" aria-labelledby="person-detail-title" data-screen-label="用户详情">
    <DetailTop label="个人详情" onBack={onBack}/>
    <div className="person-detail-cover"><SafeImage src={person.photos[0].url} alt={person.displayName} ratio="4 / 5"/><div className="detail-cover__shade"/><div className="person-detail-copy"><span>{person.verification.personhood === VerificationStatus.VERIFIED && <CheckCircle2 size={15}/>}资料已审核 · {person.city}</span><h1 id="person-detail-title" tabIndex={-1}>{person.displayName}，{person.age}</h1><p>{relationshipLabel(person)}</p></div></div>
    <div className="detail-body">
      <section className="insight-panel insight-panel--rose"><span><Sparkles size={16}/>为什么推荐</span><h2>有清楚、可验证的共同点</h2><p>你们都公开表达了对 {person.interests.slice(0,2).join('、')} 的兴趣，也偏好从共同体验开始认识彼此。</p><small>只使用双方授权的兴趣与生活方式生成；单向选择始终保密。</small></section>
      <section className="detail-section"><h2>关于 {person.displayName}</h2><p>{person.bio}</p><div className="detail-tags">{person.interests.map((tag) => <span key={tag}>{tag}</span>)}</div></section>
      <section className="detail-section"><h2>最近想做的事</h2><p>{person.prompts[0]?.answer ?? '从一件真正喜欢的小事开始。'}</p><button className="linked-event" onClick={() => onOpenActivity(suggestedActivity)}><SafeImage src={suggestedActivity.cover.url} alt="" ratio="1"/><span><small>适合邀请的活动</small><b>{suggestedActivity.title}</b><em>{dateLabel(suggestedActivity)} · {suggestedActivity.publicLocation.district}</em></span></button></section>
      <section className="safety-panel"><LockKeyhole/><div><h2>低压力连接</h2><p>心动不会通知对方。只有双方都表达心动，才会建立一个可发消息的连接。</p><button type="button"><Flag size={14}/>举报或屏蔽</button></div></section>
    </div>
    <footer className="sticky-action sticky-action--single"><button className={'primary-button heart-cta ' + (hearted ? 'is-active' : '')} disabled={hearting} onClick={onHeart}><Heart fill={hearted ? 'currentColor' : 'none'}/>{hearting ? '正在确认…' : hearted ? '已心动 · 仅你可见' : '心动'}</button></footer>
  </article>;
}

export function OpportunityDetail({ activity, onBack, onCreate }: { activity: ActivityOpportunity; onBack: () => void; onCreate: () => void }) {
  useDetailFocus('opportunity-detail-title');
  return <article className="detail-page opportunity-detail" data-screen-label="活动灵感"><DetailTop label="活动灵感" onBack={onBack}/><div className="opportunity-hero"><Sparkles/><span>还没有真实组局</span><h1 id="opportunity-detail-title" tabIndex={-1}>{activity.title}</h1><p>{activity.summary}</p><small>{activity.authorizedInterestCount} 人已授权展示兴趣聚合 · 不显示具体身份</small></div><div className="detail-body"><section className="detail-section"><h2>从一个清楚的计划开始</h2><p>选择时间、公开区域与参与模式，提交审核后才会成为真实活动。平台不会把预测兴趣用户显示为参与者。</p></section></div><footer className="sticky-action sticky-action--single"><button className="primary-button" onClick={onCreate}>发起这个活动</button></footer></article>;
}

function relationshipLabel(person: Person) { return person.relationshipGoal === RelationshipGoal.LONG_TERM ? '期待长期关系' : person.relationshipGoal === RelationshipGoal.SERIOUS_DATING ? '认真了解' : '从相处开始探索'; }
function dateLabel(activity: Activity) { return new Date(activity.schedule.startsAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric',weekday:'short'}); }
function timeLabel(activity: Activity) { return new Date(activity.schedule.startsAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}); }
function durationLabel(activity: Activity) { const minutes=(new Date(activity.schedule.endsAt).getTime()-new Date(activity.schedule.startsAt).getTime())/60000; return '约 '+(minutes%60===0?minutes/60:(minutes/60).toFixed(1))+' 小时'; }
function activityCategory(activity: Activity) { const labels: Record<string,string>={EXHIBITION:'展览',CITY_WALK:'散步',SPORT:'运动',MUSIC:'音乐',FILM:'电影',FOOD:'美食',CRAFT:'手作',OUTDOOR:'户外'}; return labels[activity.category] ?? activity.category; }
