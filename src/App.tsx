import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { JoinConfirmDialog } from './components/ConfirmDialog';
import { TopicMatchDialog } from './components/TopicMatchDialog';
import type { CardActions } from './components/ContentCard';
import { ActivityDetail, OpportunityDetail, PersonDetail } from './components/DetailViews';
import { TopicDetail } from './components/TopicDetail';
import { Modal } from './components/Modal';
import { OfflineBanner } from './components/StatusUI';
import { DemoActionError, runDemoMutation } from './actionController';
import { DiscussionContinueDecision, DiscussionMatchMode, FeedAction, FeedCardType, MessageKind, ParticipationMode, ThreadKind, type Activity, type FeedCard, type Message, type Person, type Thread, type Topic, type TopicVoteRecord } from './domain';
import { activities, activityApplications, activityFeed, currentUser, findActivityById, findActivityOpportunityById, findPersonById, findTopicById, getMessagesForThread, messages, people, resolveFeedCardEntity, threads, topics } from './mockData';
import { counterpartOf, createTopicDiscussion, findActiveTopicDiscussion, initialDiscussionRuntime, type DiscussionRuntime, type TopicMatchSession } from './topicMatch';
import { pickPartnerForMode, useTopicVotes } from './topicVote';
import { canonicalPath, parseRoute, routeTab, sanitizeRoute, type AppRoute, useBrowserRouter } from './router';
import { useOnlineStatus, usePersistentSet, useScrollMemory, useTransientMessage } from './state';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChatPage } from './pages/ChatPage';
import { CreateActivityPage, createEmptyActivityDraft } from './pages/CreateActivityPage';
import { SearchPage } from './pages/SearchPage';
import { randomId } from './randomId';
import { findGeneratedTopicById, resolveGeneratedTopicEntity } from './topicGenerator';

type PendingAction = { key: string; expectedVersion: number } | null;

function parentPath(route: AppRoute, state: Record<string, unknown>) {
  if (typeof state.from === 'string') return state.from;
  if (route.kind === 'person') return '/discover?segment=for-you';
  if (route.kind === 'chat') return '/messages?category=' + (route.roomType === 'activity' ? 'activities' : 'matches');
  return '/home?primary=recommend&secondary=for-you';
}

export default function App() {
  const { route, location, navigate } = useBrowserRouter();
  const online = useOnlineStatus();
  const { values: savedActivities, toggle: toggleSaved } = usePersistentSet('4u:rfc:saved-activities');
  const { values: heartedPeople, toggle: toggleHeart } = usePersistentSet('4u:rfc:hearted-people');
  const { values: followedTopics, toggle: toggleTopic } = usePersistentSet('4u:rfc:followed-topics');
  const { values: joinedActivities, toggle: toggleJoined } = usePersistentSet('4u:rfc:joined-activities');
  const [message, setMessage] = useTransientMessage();
  const [pending, setPending] = useState<PendingAction>(null);
  const [heartEducation, setHeartEducation] = useState<Person | null>(null);
  const [joinConfirm, setJoinConfirm] = useState<Activity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState(() => createEmptyActivityDraft());
  const [submissionState, setSubmissionState] = useState<'idle'|'saving'|'submitting'|'submitted'|'error'>('idle');
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [createdThreads, setCreatedThreads] = useState<Thread[]>([]);
  const [createdMessages, setCreatedMessages] = useState<Message[]>([]);
  const [topicMatch, setTopicMatch] = useState<TopicMatchSession | null>(null);
  const [discussionRuntimes, setDiscussionRuntimes] = useState<Record<string, DiscussionRuntime>>({});
  const { votes: topicVotes, saveVote } = useTopicVotes();
  const scrollPositions = useRef(new Map<string, number>());
  const knownApplicationIds = useMemo<Set<string>>(() => new Set(activityApplications.map((item) => item.activityId)), []);
  const seenHeartEducation = useRef(localStorage.getItem('4u:rfc:heart-education') === 'seen');
  const listRoute = ['home','discover','messages','me'].includes(route.kind);
  useScrollMemory(location.pathname + location.search, listRoute, typeof location.state.restoreScrollY === 'number' ? location.state.restoreScrollY : undefined);

  useEffect(() => {
    const canonical = canonicalPath(route);
    if (canonical !== location.pathname + location.search) navigate(canonical, { replace: true });
  }, [location.pathname, location.search, navigate, route]);

  useEffect(() => {
    const publicRoute = route.kind === 'topic' || (route.kind === 'activity' && Boolean(findActivityById(route.id as never)));
    const privateRoute = !publicRoute && route.kind !== 'home';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.content = privateRoute ? 'noindex,nofollow' : 'index,follow';
  }, [route.kind]);

  useEffect(() => {
    if (!listRoute) return;
    const cardId = sessionStorage.getItem('4u:focus-return');
    if (!cardId) return;
    sessionStorage.removeItem('4u:focus-return');
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-card-id="' + cardId + '"] .card-main-action')?.focus({ preventScroll: true }));
  }, [listRoute, location.key]);

  const allThreads = useMemo(() => [...threads, ...createdThreads], [createdThreads]);
  const allMessages = useMemo(() => [...messages, ...createdMessages, ...sentMessages], [createdMessages, sentMessages]);

  const startTopicMatch = useCallback((topic: Topic, matchMode: DiscussionMatchMode, vote?: TopicVoteRecord) => {
    if (!online) {
      setMessage('即时匹配需要联网后确认');
      return;
    }
    const existingThread = findActiveTopicDiscussion(topic.id, matchMode, allThreads, currentUser.profile.id);
    const partnerId = existingThread ? counterpartOf(existingThread, currentUser.profile.id) : undefined;
    const partner = (partnerId && findPersonById(partnerId)) || pickPartnerForMode(matchMode, people, currentUser.profile.id, topic.id);
    setTopicMatch({ topic, partner, matchMode, vote, existingThread, phase: 'searching' });
  }, [allThreads, online, setMessage]);

  const enterTopicMatch = useCallback(() => {
    if (!topicMatch) return;
    const prepared = topicMatch.existingThread
      ? { thread: topicMatch.existingThread, messages: [] as Message[] }
      : createTopicDiscussion(topicMatch.topic, topicMatch.partner, currentUser.profile.id, topicMatch.matchMode);
    if (!topicMatch.existingThread) {
      setCreatedThreads((items) => items.some((item) => item.id === prepared.thread.id) ? items : [...items, prepared.thread]);
      setCreatedMessages((items) => [...items, ...prepared.messages]);
    }
    setDiscussionRuntimes((current) => ({
      ...current,
      [prepared.thread.id]: current[prepared.thread.id] ?? initialDiscussionRuntime(prepared.thread, topicMatch.vote),
    }));
    setTopicMatch(null);
    setMessage('和他聊一聊吧');
    navigate('/messages/discussion/' + prepared.thread.id, { state: { from: location.pathname + location.search } });
  }, [location.pathname, location.search, navigate, setMessage, topicMatch]);

  const go = useCallback((path: string) => navigate(path), [navigate]);
  const rememberCurrentScroll = useCallback(() => {
    const key = location.pathname + location.search;
    scrollPositions.current.set(key, window.scrollY);
    sessionStorage.setItem('4u:scroll:' + key, String(window.scrollY));
    return window.scrollY;
  }, [location.pathname, location.search]);
  const openFromFeed = useCallback((card: FeedCard) => {
    const from = location.pathname + location.search;
    const state = { from, cardId: card.cardId, scrollY: rememberCurrentScroll() };
    if (card.cardType === FeedCardType.PERSON) navigate('/people/' + card.entityId, { state });
    else if (card.cardType === FeedCardType.TOPIC) navigate('/topics/' + card.entityId, { state });
    else if (card.cardType === FeedCardType.ACTIVITY) navigate('/activities/' + card.entityId, { state });
    else navigate('/activities/' + card.entityId, { state });
  }, [location.pathname, location.search, navigate, rememberCurrentScroll]);

  const mutate = useCallback(async (key: string, version: number, requiresOnline: boolean, commit: () => void, success: string) => {
    setPending({ key, expectedVersion: version });
    try {
      await runDemoMutation({ action: key.split(':')[0], entityId: key.split(':')[1], expectedVersion: version, currentVersion: version, requiresOnline, commit });
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof DemoActionError ? error.message : '操作未完成，请重试');
    } finally { setPending(null); }
  }, [setMessage]);

  const saveActivity = useCallback((activity: Activity) => {
    const willSave = !savedActivities.has(activity.id);
    void mutate('activity:' + activity.id, activity.entityVersion, false, () => toggleSaved(activity.id), willSave ? (online ? '活动已收藏' : '已离线保存，联网后可同步') : '已取消收藏');
  }, [mutate, online, savedActivities, toggleSaved]);

  const heartPerson = useCallback((person: Person) => {
    if (!heartedPeople.has(person.id) && !seenHeartEducation.current) { setHeartEducation(person); return; }
    const willHeart = !heartedPeople.has(person.id);
    void mutate('person:' + person.id, person.entityVersion, true, () => toggleHeart(person.id), willHeart ? '已心动，仅你可见' : '已撤回心动');
  }, [heartedPeople, mutate, toggleHeart]);

  const confirmHeart = useCallback(() => {
    const person = heartEducation;
    if (!person) return;
    seenHeartEducation.current = true;
    localStorage.setItem('4u:rfc:heart-education', 'seen');
    setHeartEducation(null);
    void mutate('person:' + person.id, person.entityVersion, true, () => toggleHeart(person.id), '已心动，仅你可见');
  }, [heartEducation, mutate, toggleHeart]);

  const followTopic = useCallback((topic: Topic) => {
    const willFollow = !followedTopics.has(topic.id);
    void mutate('topic:' + topic.id, topic.entityVersion, false, () => toggleTopic(topic.id), willFollow ? '已关注话题' : '已取消关注');
  }, [followedTopics, mutate, toggleTopic]);

  const cardActions: CardActions = useMemo(() => ({
    savedActivities, heartedPeople, followedTopics,
    pendingKey: pending?.key,
    onOpen: openFromFeed,
    onSaveActivity: saveActivity,
    onHeartPerson: heartPerson,
    onFollowTopic: followTopic,
    onOpenActivity: (activity) => navigate('/activities/' + activity.id, { state: { from: location.pathname + location.search, scrollY: rememberCurrentScroll() } }),
    resolveEntity: (card) => resolveGeneratedTopicEntity(card) ?? resolveFeedCardEntity(card),
  }), [followedTopics, heartPerson, heartedPeople, location.pathname, location.search, navigate, openFromFeed, pending?.key, rememberCurrentScroll, saveActivity, savedActivities]);

  const refresh = () => { setRefreshing(true); window.setTimeout(() => { setRefreshing(false); setMessage('已刷新为最新安全快照'); }, 650); };
  const routeBack = () => {
    if (typeof location.state.cardId === 'string') sessionStorage.setItem('4u:focus-return', location.state.cardId);
    if (typeof location.state.from === 'string' && typeof location.state.scrollY === 'number') sessionStorage.setItem('4u:scroll:' + location.state.from, String(location.state.scrollY));
    if (typeof location.state.from === 'string') navigate(location.state.from, { replace: true, state: { restoreScrollY: scrollPositions.current.get(location.state.from) ?? location.state.scrollY } });
    else navigate(parentPath(route, location.state), { replace: true });
  };

  let page: React.ReactNode;
  if (route.kind === 'home') page = <HomePage primary={route.primary} secondary={route.secondary} cardActions={cardActions} loading={refreshing} onRetry={refresh} onNavigate={go} onSearch={() => navigate('/search', { state: { from: location.pathname + location.search } })} onNotifications={() => go('/messages?category=notifications')} onCreate={() => go('/activities/new/local-draft/1')}/>;
  else if (route.kind === 'discover') page = <DiscoverPage segment={route.segment} cardActions={cardActions} loading={refreshing} onRetry={refresh} onNavigate={go}/>;
  else if (route.kind === 'messages') page = <MessagesPage category={route.category} threads={allThreads} messages={allMessages} people={people} activities={activities} topics={topics} currentUserId={currentUser.profile.id} notifications={demoNotifications} onCategoryChange={(category) => go('/messages?category=' + category)} onOpenThread={(roomType, threadId) => go('/messages/' + roomType + '/' + threadId)} onOpenNotification={() => setMessage('通知详情已读取')}/>;
  else if (route.kind === 'me') page = <ProfilePage section={route.section} user={currentUser} assets={{saved:savedActivities.size,active:activityApplications.filter((item)=>item.semantics.canAccessRoom).length,applications:activityApplications.length + joinedActivities.size,drafts:Number(Boolean(localStorage.getItem('4u:rfc:activity-draft')))}} onSectionChange={(section) => go('/me/' + section)} onEditProfile={() => setMessage('资料编辑将在服务端接入后开放')} onEditRelationship={() => setMessage('关系意图编辑将在服务端接入后开放')} onOpenAsset={(asset) => setMessage('已打开' + asset + '（演示）')} onOpenPermission={() => setMessage('权限字段只展示，不在前端模拟修改')}/>;
  else if (route.kind === 'chat') {
    const thread = allThreads.find((item) => item.id === route.roomId);
    const topic = thread?.kind === ThreadKind.TOPIC_DISCUSSION ? (findGeneratedTopicById(thread.topicId) ?? findTopicById(thread.topicId)) : undefined;
    const runtime = thread && (discussionRuntimes[thread.id] ?? (thread.kind === ThreadKind.TOPIC_DISCUSSION ? initialDiscussionRuntime(thread, topicVotes[thread.topicId]) : undefined));
    const partner = thread ? findPersonById(counterpartOf(thread, currentUser.profile.id) as never) : undefined;
    page = thread ? <ChatPage roomType={route.roomType} thread={thread} messages={[...getMessagesForThread(thread.id),...createdMessages.filter((item)=>item.threadId===thread.id),...sentMessages.filter((item)=>item.threadId===thread.id)]} people={people} currentUserId={currentUser.profile.id} connection={{transport:online?'WS':'POLLING',phase:online?'LIVE':'OFFLINE',attempted:online?['WS']:['WS','SSE','POLLING'],lastReceivedSeq:thread.messageIds.length + sentMessages.filter((item)=>item.threadId===thread.id).length,pollingIntervalSeconds:10}} onBack={routeBack} onSend={async(request)=>{await runDemoMutation({action:'send',entityId:request.threadId,expectedVersion:thread.entityVersion,currentVersion:thread.entityVersion,requiresOnline:true,commit:()=>{setSentMessages((items)=>[...items,{id:('message_local_'+randomId().replaceAll('-','')) as never,threadId:request.threadId,kind:'TEXT' as never,senderId:currentUser.profile.id,text:request.text,createdAt:new Date().toISOString() as never,deliveryStatus:'SENT' as never}]);}});setMessage('消息已明确发送（本地演示）');}} discussionRoom={topic && runtime ? { topic, runtime, partner, onNextPrompt: (prompt) => { setCreatedMessages((items) => [...items, { id: ('message_prompt_' + randomId().replaceAll('-', '')) as never, threadId: thread.id, kind: MessageKind.STRUCTURED_PROMPT, senderId: null, promptStage: prompt.promptStage, text: prompt.text, createdAt: new Date().toISOString() as never, deliveryStatus: 'SENT' as never }]); setMessage('已加入下一阶段提示，不会代你发送'); }, onContinue: () => { setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.CONTINUE, partnerDecision: DiscussionContinueDecision.CONTINUE, unlocked: true } })); setCreatedMessages((items) => [...items, { id: ('message_continue_' + randomId().replaceAll('-', '')) as never, threadId: thread.id, kind: MessageKind.SYSTEM, senderId: null, event: 'MATCH_CREATED' as never, text: '你们都愿意继续认识。已按隐私设置解锁更多资料。', createdAt: new Date().toISOString() as never, deliveryStatus: 'SENT' as never }]); setMessage('双方已同意继续认识'); }, onFinish: () => { setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.FINISH } })); setMessage('讨论已结束，不会向对方展示原因'); routeBack(); }, onLeave: () => { setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.LEFT_TEMPORARILY } })); setMessage('已暂时离开，房间会保留一段时间'); routeBack(); }, onReport: () => { setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.REPORTED } })); setMessage('已中止并进入安全处理（演示）'); routeBack(); } } : undefined}/> : <NotFound onBack={routeBack}/>;
  }
  else if (route.kind === 'create') page = <CreateActivityPage draftId={route.draftId} step={route.step} draft={draft} submissionState={submissionState} onDraftChange={setDraft} onStepChange={(step) => go('/activities/new/' + route.draftId + '/' + step)} onCancel={()=>go('/home?primary=activities&secondary=all')} onSaveDraft={async(next)=>{localStorage.setItem('4u:rfc:activity-draft',JSON.stringify(next));setSubmissionState('saving');await new Promise((resolve)=>setTimeout(resolve,250));setSubmissionState('idle');setMessage('草稿已保存在当前设备');}} onSubmitForReview={async()=>{setSubmissionState('submitting');await new Promise((resolve)=>setTimeout(resolve,450));setSubmissionState('submitted');}}/>;
  else if (route.kind === 'search') page = <SearchPage query={route.query} activities={activities} people={people} topics={topics} onQueryChange={(query) => navigate('/search' + (query ? '?q=' + encodeURIComponent(query) : ''), { replace: true, state: location.state })} onOpenActivity={(activity)=>navigate('/activities/'+activity.id,{state:{from:location.pathname+location.search}})} onOpenPerson={(person)=>navigate('/people/'+person.id,{state:{from:location.pathname+location.search}})} onOpenTopic={(topic)=>navigate('/topics/'+topic.id,{state:{from:location.pathname+location.search}})} onBack={routeBack}/>;
  else page = null;

  let detail: React.ReactNode = null;
  if (route.kind === 'activity') {
    const activity = findActivityById(route.id as never);
    const opportunity = findActivityOpportunityById(route.id as never);
    if (activity) { const card=activityFeed.find((item)=>item.entityId===activity.id); const hasApplication=knownApplicationIds.has(activity.id)||joinedActivities.has(activity.id); const canJoin=!hasApplication&&Boolean(card&&(card.allowedActions as readonly FeedAction[]).some((action)=>action===FeedAction.JOIN_ACTIVITY||action===FeedAction.APPLY_TO_ACTIVITY)); detail = <ActivityDetail activity={activity} saved={savedActivities.has(activity.id)} joined={hasApplication} canJoin={canJoin} joining={pending?.key === 'join:' + activity.id} onBack={routeBack} onSave={() => saveActivity(activity)} onJoin={() => hasApplication ? setMessage('当前已有申请或参与记录') : canJoin && setJoinConfirm(activity)}/>; }
    else if (opportunity) detail = <OpportunityDetail activity={opportunity} onBack={routeBack} onCreate={() => go('/activities/new/local-draft/1')}/>;
  } else if (route.kind === 'person') {
    const person = findPersonById(route.id as never);
    if (person) detail = <PersonDetail person={person} suggestedActivity={activities[0]} hearted={heartedPeople.has(person.id)} hearting={pending?.key === 'person:' + person.id} onBack={routeBack} onHeart={() => heartPerson(person)} onOpenActivity={(activity) => navigate('/activities/' + activity.id,{state:{from:location.pathname+location.search}})}/>;
  } else if (route.kind === 'topic') {
    const topic = findGeneratedTopicById(route.id as never) ?? findTopicById(route.id as never);
    if (topic) detail = <TopicDetail topic={topic} vote={topicVotes[topic.id]} online={online} matching={topicMatch?.topic.id === topic.id} onBack={routeBack} onSaveVote={saveVote} onStartDiscussion={(mode, vote) => startTopicMatch(topic, mode, vote)}/>;
  }

  if (detail && !['home','discover','messages','me'].includes(route.kind)) {
    const from = typeof location.state.from === 'string' ? location.state.from : parentPath(route, location.state);
    const background = parseBackground(from);
    if (background.kind === 'home') page = <HomePage primary={background.primary} secondary={background.secondary} cardActions={cardActions} onRetry={refresh} onNavigate={go} onSearch={() => go('/search')} onNotifications={() => go('/messages?category=notifications')} onCreate={() => go('/activities/new/local-draft/1')}/>;
    else if (background.kind === 'discover') page = <DiscoverPage segment={background.segment} cardActions={cardActions} onRetry={refresh} onNavigate={go}/>;
  }
  if (!detail && ['activity','person','topic'].includes(route.kind)) page = <NotFound onBack={routeBack}/>;

  return <>
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    {!online && <OfflineBanner/>}
    <AppShell active={routeTab(route)} detail={detail} immersive={['chat','create','search'].includes(route.kind)} onNavigate={go} onCreate={() => go('/activities/new/local-draft/1')}>{page}</AppShell>
    {joinConfirm && <JoinConfirmDialog activity={joinConfirm} pending={pending?.key === 'join:' + joinConfirm.id} onCancel={() => setJoinConfirm(null)} onConfirm={() => { const activity = joinConfirm; const result = activity.participationMode === ParticipationMode.OPEN_JOIN ? '已确认参加，席位状态已更新' : activity.participationMode === ParticipationMode.MATCH_FORMATION ? '参与意愿已提交，等待匹配成行' : '申请已提交，等待发起者审核'; void mutate('join:' + activity.id, activity.entityVersion, true, () => { toggleJoined(activity.id); setJoinConfirm(null); }, result); }}/>}
    {heartEducation && <Modal title="心动只属于你" onClose={() => setHeartEducation(null)}><div className="heart-education"><Heart fill="currentColor"/><p>你的选择仅自己可见；只有对方也对你心动，双方才会收到通知并开启会话。</p><span>心动不等于报名，也不会绕过双方同意。</span></div><button className="primary-button" onClick={confirmHeart}>知道了，继续心动</button><button className="text-button" onClick={() => setHeartEducation(null)}>暂不操作</button></Modal>}
    {topicMatch && <TopicMatchDialog session={topicMatch} onCancel={() => setTopicMatch(null)} onReady={() => setTopicMatch((current) => current ? { ...current, phase: 'matched' } : current)} onEnter={enterTopicMatch}/>}
    {message && <div className="toast" role="status" aria-live="polite">{message}</div>}
  </>;
}

const demoNotifications = [
  { id:'notification_seat' as const, tone:'ACTIVITY' as const, title:'请在 12 小时内确认席位', body:'莫奈夜展同行为你保留了一个临时席位，逾期将自动释放。', createdAt:'2026-08-22T15:20:00+08:00', unread:true, actionLabel:'查看申请' },
  { id:'notification_safety' as const, tone:'SAFETY' as const, title:'活动安全提醒', body:'首次见面建议选择公共场所，不勉强交换联系方式。', createdAt:'2026-08-22T09:10:00+08:00', unread:false },
];

function NotFound({onBack}:{onBack:()=>void}) { return <section className="detail-page"><div className="state-card"><h1>内容暂不可用</h1><p>它可能已下架、过期或当前没有访问权限。</p><button className="secondary-button" onClick={onBack}>返回</button></div></section>; }

function parseBackground(path: string): AppRoute {
  const url = new URL(path, window.location.origin);
  const parsed = sanitizeRoute(parseRoute(url.pathname, url.search));
  return parsed.kind === 'home' || parsed.kind === 'discover'
    ? parsed
    : { kind: 'home', primary: 'recommend', secondary: 'for-you' };
}
