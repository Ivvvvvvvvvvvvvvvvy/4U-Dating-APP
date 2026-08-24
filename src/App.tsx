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
import { ConversationStatus, DiscussionContinueDecision, DiscussionMatchMode, FeedAction, FeedCardType, MatchStatus, MessageDeliveryStatus, MessageKind, ParticipationMode, ThreadAction, ThreadKind, type Activity, type CurrentUser, type FeedCard, type Message, type Person, type Thread, type Topic, type TopicVoteRecord } from './domain';
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
import { CreateActivityPage } from './pages/CreateActivityPage';
import { SearchPage } from './pages/SearchPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { EntryPage } from './pages/EntryPage';
import { LoginPage } from './pages/LoginPage';
import { buildCurrentUser, loadUserProfile } from './auth/profile';
import { signOutSession, useAuth } from './auth/useAuth';
import { clearActivityDraft, createEmptyActivityDraft, hasStoredActivityDraft, loadActivityDraft, saveActivityDraft } from './activityDraft';
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
  const auth = useAuth();
  const [dbProfile, setDbProfile] = useState<{ person: Person; user: CurrentUser } | null>(null);
  const { values: savedActivities, toggle: toggleSaved } = usePersistentSet('4u:rfc:saved-activities');
  const { values: heartedPeople, toggle: toggleHeart } = usePersistentSet('4u:rfc:hearted-people');
  const { values: followedTopics, toggle: toggleTopic } = usePersistentSet('4u:rfc:followed-topics');
  const { values: joinedActivities, toggle: toggleJoined } = usePersistentSet('4u:rfc:joined-activities');
  const { values: endedThreads, setValues: setEndedThreads } = usePersistentSet('4u:rfc:ended-threads');
  const { values: blockedPeople, setValues: setBlockedPeople } = usePersistentSet('4u:rfc:blocked-people');
  const [message, setMessage] = useTransientMessage();
  const [pending, setPending] = useState<PendingAction>(null);
  const [heartEducation, setHeartEducation] = useState<Person | null>(null);
  const [joinConfirm, setJoinConfirm] = useState<Activity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const initialDraftId = route.kind === 'create' ? route.draftId : 'local-draft';
  const [draft, setDraft] = useState(() => loadActivityDraft(initialDraftId));
  const [submissionState, setSubmissionState] = useState<'idle'|'saving'|'submitting'|'submitted'|'error'>('idle');
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [createdThreads, setCreatedThreads] = useState<Thread[]>([]);
  const [createdMessages, setCreatedMessages] = useState<Message[]>([]);
  const [topicMatch, setTopicMatch] = useState<TopicMatchSession | null>(null);
  const [topicMatchRotations, setTopicMatchRotations] = useState<Record<string, number>>({});
  const [discussionRuntimes, setDiscussionRuntimes] = useState<Record<string, DiscussionRuntime>>({});
  const { votes: topicVotes, saveVote } = useTopicVotes();
  const statusStackRef = useRef<HTMLDivElement>(null);
  const loadedDraftId = useRef(initialDraftId);
  const scrollPositions = useRef(new Map<string, number>());
  const knownApplicationIds = useMemo<Set<string>>(() => new Set(activityApplications.map((item) => item.activityId)), []);
  const conversationEligibleActivityIds = useMemo<Set<string>>(() => new Set(activityApplications
    .filter((item) => item.semantics.canAccessRoom)
    .map((item) => item.activityId)), []);
  const seenHeartEducation = useRef(localStorage.getItem('4u:rfc:heart-education') === 'seen');
  const listRoute = ['home','discover','messages','me'].includes(route.kind);
  useScrollMemory(location.pathname + location.search, listRoute, typeof location.state.restoreScrollY === 'number' ? location.state.restoreScrollY : undefined);

  useEffect(() => {
    const statusStack = statusStackRef.current;
    if (!statusStack) return;
    const syncStatusStackHeight = () => document.documentElement.style.setProperty('--status-stack-height', `${statusStack.getBoundingClientRect().height}px`);
    syncStatusStackHeight();
    const observer = new ResizeObserver(syncStatusStackHeight);
    observer.observe(statusStack);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--status-stack-height'); };
  }, [online]);

  useEffect(() => {
    if (route.kind !== 'create' || loadedDraftId.current === route.draftId) return;
    loadedDraftId.current = route.draftId;
    setDraft(loadActivityDraft(route.draftId));
    setSubmissionState('idle');
  }, [route]);

  useEffect(() => {
    let cancelled = false;
    if (auth.status !== 'signedIn') { setDbProfile(null); return; }
    void loadUserProfile(auth.user.id).then((loaded) => {
      if (cancelled || !loaded) return;
      setDbProfile({ person: loaded.person, user: buildCurrentUser(loaded) });
    });
    return () => { cancelled = true; };
  }, [auth]);

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
    const rotationKey = `${topic.id}:${matchMode}`;
    const partner = (partnerId && findPersonById(partnerId)) || pickPartnerForMode(
      matchMode,
      people,
      currentUser.profile.id,
      topic.id,
      topicMatchRotations[rotationKey] ?? 0,
    );
    if (!partner) {
      setMessage(existingThread ? '会话成员资料暂不可用' : '暂时没有可匹配的讨论对象');
      return;
    }
    setTopicMatch({ topic, partner, matchMode, vote, existingThread, phase: 'searching' });
  }, [allThreads, online, setMessage, topicMatchRotations]);

  const cancelTopicMatch = useCallback(() => {
    if (topicMatch?.phase === 'matched' && !topicMatch.existingThread) {
      const rotationKey = `${topicMatch.topic.id}:${topicMatch.matchMode}`;
      setTopicMatchRotations((current) => ({
        ...current,
        [rotationKey]: (current[rotationKey] ?? 0) + 1,
      }));
    }
    setTopicMatch(null);
  }, [topicMatch]);

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
    void mutate('person:' + person.id, person.entityVersion, true, () => toggleHeart(person.id), willHeart ? '已喜欢，仅你可见' : '已取消喜欢');
  }, [heartedPeople, mutate, toggleHeart]);

  const confirmHeart = useCallback(() => {
    const person = heartEducation;
    if (!person) return;
    seenHeartEducation.current = true;
    localStorage.setItem('4u:rfc:heart-education', 'seen');
    setHeartEducation(null);
    void mutate('person:' + person.id, person.entityVersion, true, () => toggleHeart(person.id), '已喜欢，仅你可见');
  }, [heartEducation, mutate, toggleHeart]);

  const followTopic = useCallback((topic: Topic) => {
    const willFollow = !followedTopics.has(topic.id);
    void mutate('topic:' + topic.id, topic.entityVersion, false, () => toggleTopic(topic.id), willFollow ? '已关注话题' : '已取消关注');
  }, [followedTopics, mutate, toggleTopic]);

  const startConversation = useCallback((person: Person) => {
    if (blockedPeople.has(person.id)) {
      setMessage('你已停止接收该成员的消息，可在安全设置中管理');
      return;
    }
    const existing = allThreads.find((thread) => thread.kind === ThreadKind.MATCH
      && thread.participantIds.includes(currentUser.profile.id)
      && thread.participantIds.includes(person.id));
    if (existing) {
      navigate('/messages/match/' + existing.id, { state: { from: location.pathname + location.search } });
      return;
    }

    const token = randomId().replaceAll('-', '');
    const threadId = ('thread_direct_' + token) as never;
    const messageId = ('message_direct_' + token) as never;
    const now = new Date().toISOString() as never;
    const nextThread: Thread = {
      id: threadId,
      entityVersion: 1,
      kind: ThreadKind.MATCH,
      title: person.displayName,
      participantIds: [currentUser.profile.id, person.id],
      messageIds: [messageId],
      createdAt: now,
      updatedAt: now,
      unreadCount: 0,
      allowedActions: [ThreadAction.SEND_MESSAGE, ThreadAction.VIEW_PROFILE, ThreadAction.UNMATCH, ThreadAction.BLOCK, ThreadAction.REPORT],
      matchId: ('match_direct_' + token) as never,
      matchStatus: MatchStatus.ACTIVE,
      conversationStatus: ConversationStatus.READY,
    };
    const nextMessage: Message = {
      id: messageId,
      threadId,
      kind: MessageKind.SYSTEM,
      senderId: null,
      event: 'THREAD_OPENED',
      text: `你已向${person.displayName}发起对话。是否回复由对方决定，请尊重彼此边界。`,
      createdAt: now,
      deliveryStatus: MessageDeliveryStatus.SENT,
    };
    setCreatedThreads((items) => [...items, nextThread]);
    setCreatedMessages((items) => [...items, nextMessage]);
    setMessage('对话已创建');
    navigate('/messages/match/' + threadId, { state: { from: location.pathname + location.search } });
  }, [allThreads, blockedPeople, location.pathname, location.search, navigate, setMessage]);

  const startActivityParticipantConversation = useCallback((activity: Activity, person: Person) => {
    const isVisibleParticipant = activity.visibleParticipants.some((participant) => participant.personId === person.id);
    if (!conversationEligibleActivityIds.has(activity.id) || !isVisibleParticipant) {
      setMessage('确认参加同一活动后才可发起对话');
      return;
    }
    startConversation(person);
  }, [conversationEligibleActivityIds, setMessage, startConversation]);

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
  const leaveCreateFlow = () => {
    setSubmissionState('idle');
    navigate('/home?primary=activities&secondary=all');
  };
  const persistDraft = async (draftId: string, nextDraft: typeof draft) => {
    setSubmissionState('saving');
    try {
      saveActivityDraft(draftId, nextDraft);
      await new Promise((resolve) => setTimeout(resolve, 250));
      setMessage('草稿已保存在当前设备');
    } catch (error) {
      setSubmissionState('error');
      throw error;
    } finally {
      setSubmissionState((current) => current === 'error' ? current : 'idle');
    }
  };
  const submitDraft = async (draftId: string) => {
    setSubmissionState('submitting');
    await new Promise((resolve) => setTimeout(resolve, 450));
    clearActivityDraft(draftId);
    setDraft(createEmptyActivityDraft());
    setSubmissionState('submitted');
  };

  let page: React.ReactNode;
  if (auth.status === 'loading') page = null;
  else if (route.kind === 'entry') page = auth.status === 'signedIn'
    ? <HomePage primary="recommend" secondary="for-you" cardActions={cardActions} loading={refreshing} onRetry={refresh} onNavigate={go} onSearch={() => navigate('/search', { state: { from: location.pathname + location.search } })} onNotifications={() => go('/messages?category=notifications')} onCreate={() => go('/activities/new/local-draft/1')}/>
    : <EntryPage onGuest={() => go('/home?primary=recommend&secondary=for-you')} onRegister={() => go('/onboarding/welcome')} onLogin={() => go('/login')}/>;
  else if (route.kind === 'login') page = <LoginPage onBack={() => go('/')} onLogin={() => go('/home?primary=recommend&secondary=for-you')} onGoRegister={() => go('/onboarding/welcome')}/>;
  else if (route.kind === 'home') page = <HomePage primary={route.primary} secondary={route.secondary} cardActions={cardActions} loading={refreshing} onRetry={refresh} onNavigate={go} onSearch={() => navigate('/search', { state: { from: location.pathname + location.search } })} onNotifications={() => go('/messages?category=notifications')} onCreate={() => go('/activities/new/local-draft/1')}/>;
  else if (route.kind === 'discover') page = <DiscoverPage segment={route.segment} cardActions={cardActions} loading={refreshing} onRetry={refresh} onNavigate={go}/>;
  else if (route.kind === 'messages') page = <MessagesPage category={route.category} threads={allThreads} messages={allMessages} people={people} activities={activities} topics={topics} currentUserId={currentUser.profile.id} notifications={demoNotifications} onCategoryChange={(category) => go('/messages?category=' + category)} onOpenThread={(roomType, threadId) => go('/messages/' + roomType + '/' + threadId)} onOpenNotification={() => setMessage('通知详情已读取')}/>;
  else if (route.kind === 'me') page = <ProfilePage section={route.section} user={dbProfile?.user ?? currentUser} assets={{saved:savedActivities.size,active:activityApplications.filter((item)=>item.semantics.canAccessRoom).length,applications:activityApplications.length + joinedActivities.size,drafts:Number(hasStoredActivityDraft())}} onSectionChange={(section) => go('/me/' + section)} onEditProfile={() => setMessage('资料编辑功能即将开放')} onEditRelationship={() => setMessage('关系意向编辑功能即将开放')} onOpenAsset={(asset) => setMessage('已打开' + asset)} onOpenPermission={() => setMessage('可在这里查看当前资料权限')} onLogout={dbProfile ? () => { void signOutSession(); go('/'); } : undefined}/>;
  else if (route.kind === 'chat') {
    const thread = allThreads.find((item) => item.id === route.roomId);
    const topic = thread?.kind === ThreadKind.TOPIC_DISCUSSION ? (findGeneratedTopicById(thread.topicId) ?? findTopicById(thread.topicId)) : undefined;
    const runtime = thread && (discussionRuntimes[thread.id] ?? (thread.kind === ThreadKind.TOPIC_DISCUSSION ? initialDiscussionRuntime(thread, topicVotes[thread.topicId]) : undefined));
    const partner = thread ? findPersonById(counterpartOf(thread, currentUser.profile.id) as never) : undefined;
    const blockedCounterpart = partner ? blockedPeople.has(partner.id) : false;
    page = thread ? <ChatPage roomType={route.roomType} thread={thread} messages={[...getMessagesForThread(thread.id),...createdMessages.filter((item)=>item.threadId===thread.id),...sentMessages.filter((item)=>item.threadId===thread.id)]} people={people} currentUserId={currentUser.profile.id} conversationEnded={endedThreads.has(thread.id) || blockedCounterpart} connection={{transport:online?'WS':'POLLING',phase:online?'LIVE':'OFFLINE',attempted:online?['WS']:['WS','SSE','POLLING'],lastReceivedSeq:thread.messageIds.length + sentMessages.filter((item)=>item.threadId===thread.id).length,pollingIntervalSeconds:10}} onBack={routeBack} onContinue={() => setMessage('已选择继续认识')} onFinish={() => { setEndedThreads((current) => new Set(current).add(thread.id)); if (runtime) setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.FINISH } })); setMessage('讨论已结束'); routeBack(); }} onReport={(request) => { setEndedThreads((current) => new Set(current).add(thread.id)); const blockedPersonId = request.subject.type === 'PERSON' ? request.subject.personId : null; if (request.blockAfterReport && blockedPersonId) { setBlockedPeople((current) => new Set(current).add(blockedPersonId)); allThreads.filter((item) => item.participantIds.includes(blockedPersonId)).forEach((item) => setEndedThreads((current) => new Set(current).add(item.id))); } if (runtime) setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.REPORTED } })); setMessage('举报已提交，平台会尽快处理'); routeBack(); }} onSend={async(request)=>{await runDemoMutation({action:'send',entityId:request.threadId,expectedVersion:thread.entityVersion,currentVersion:thread.entityVersion,requiresOnline:true,commit:()=>{setSentMessages((items)=>[...items,{id:('message_local_'+randomId().replaceAll('-', '')) as never,threadId:request.threadId,kind:'TEXT' as never,senderId:currentUser.profile.id,text:request.text,createdAt:new Date().toISOString() as never,deliveryStatus:'SENT' as never}]);}});setMessage('消息已发送');}} discussionRoom={topic && runtime ? { topic, runtime, partner, onNextPrompt: (prompt) => { setCreatedMessages((items)=>[...items, { id: ('message_prompt_' + randomId().replaceAll('-', '')) as never, threadId: thread.id, kind: MessageKind.STRUCTURED_PROMPT, senderId: null, promptStage: prompt.promptStage, text: prompt.text, createdAt: new Date().toISOString() as never, deliveryStatus: 'SENT' as never }]); setMessage('已加入下一阶段提示，不会代你发送'); }, onContinue: () => { setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.CONTINUE } })); setMessage('已选择继续，等待对方回应'); }, onLeave: () => { setDiscussionRuntimes((current) => ({ ...current, [thread.id]: { ...(current[thread.id] ?? runtime), myDecision: DiscussionContinueDecision.LEFT_TEMPORARILY } })); setMessage('已暂时离开，房间会保留一段时间'); routeBack(); } } : undefined}/> : <NotFound onBack={routeBack}/>;
  }
  else if (route.kind === 'create') page = <CreateActivityPage key={route.draftId} draftId={route.draftId} step={route.step} draft={draft} submissionState={submissionState} onDraftChange={setDraft} onStepChange={(step) => go('/activities/new/' + route.draftId + '/' + step)} onCancel={leaveCreateFlow} onSaveDraft={(next) => persistDraft(route.draftId, next)} onSubmitForReview={() => submitDraft(route.draftId)}/>;
  else if (route.kind === 'onboarding') page = <OnboardingPage step={route.step} online={online} onNavigate={go}/>;
  else if (route.kind === 'search') page = <SearchPage query={route.query} activities={activities} people={people} topics={topics} onQueryChange={(query) => navigate('/search' + (query ? '?q=' + encodeURIComponent(query) : ''), { replace: true, state: location.state })} onOpenActivity={(activity)=>navigate('/activities/'+activity.id,{state:{from:location.pathname+location.search}})} onOpenPerson={(person)=>navigate('/people/'+person.id,{state:{from:location.pathname+location.search}})} onOpenTopic={(topic)=>navigate('/topics/'+topic.id,{state:{from:location.pathname+location.search}})} onBack={routeBack}/>;
  else page = null;

  let detail: React.ReactNode = null;
  if (route.kind === 'activity') {
    const activity = findActivityById(route.id as never);
    const opportunity = findActivityOpportunityById(route.id as never);
    if (activity) { const card=activityFeed.find((item)=>item.entityId===activity.id); const hasApplication=knownApplicationIds.has(activity.id)||joinedActivities.has(activity.id); const canJoin=!hasApplication&&Boolean(card&&(card.allowedActions as readonly FeedAction[]).some((action)=>action===FeedAction.JOIN_ACTIVITY||action===FeedAction.APPLY_TO_ACTIVITY)); const canMessageParticipants=conversationEligibleActivityIds.has(activity.id); detail = <ActivityDetail activity={activity} saved={savedActivities.has(activity.id)} joined={hasApplication} canJoin={canJoin} joining={pending?.key === 'join:' + activity.id} onBack={routeBack} onSave={() => saveActivity(activity)} onJoin={() => hasApplication ? setMessage('当前已有申请或参与记录') : canJoin && setJoinConfirm(activity)} onOpenParticipant={(person) => person.id === currentUser.profile.id ? go('/me/profile') : navigate('/people/' + person.id, { state: { from: location.pathname + location.search, activityId: activity.id, canStartConversation: canMessageParticipants } })}/>; }
    else if (opportunity) detail = <OpportunityDetail activity={opportunity} onBack={routeBack} onCreate={() => go('/activities/new/local-draft/1')}/>;
  } else if (route.kind === 'person') {
    const person = findPersonById(route.id as never);
    const hasConversation = person && allThreads.some((thread) => thread.kind === ThreadKind.MATCH && thread.participantIds.includes(person.id) && thread.participantIds.includes(currentUser.profile.id));
    const sourceActivity = typeof location.state.activityId === 'string' ? findActivityById(location.state.activityId as never) : undefined;
    const canStartFromActivity = Boolean(sourceActivity
      && location.state.canStartConversation === true
      && conversationEligibleActivityIds.has(sourceActivity.id)
      && sourceActivity.visibleParticipants.some((participant) => participant.personId === person?.id));
    if (person) detail = <PersonDetail person={person} suggestedActivity={activities[0]} hearted={heartedPeople.has(person.id)} hearting={pending?.key === 'person:' + person.id} onBack={routeBack} onHeart={() => heartPerson(person)} onOpenActivity={(activity) => navigate('/activities/' + activity.id,{state:{from:location.pathname+location.search}})} onStartConversation={person.id !== currentUser.profile.id && (canStartFromActivity || hasConversation) ? () => sourceActivity && canStartFromActivity ? startActivityParticipantConversation(sourceActivity, person) : startConversation(person) : undefined}/>;
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
    <div ref={statusStackRef} className="global-status-stack">
      {!online && <OfflineBanner/>}
    </div>
    <AppShell active={routeTab(route)} detail={detail} immersive={['entry','login','chat','create','search','onboarding'].includes(route.kind)} chromeless={route.kind === 'entry' || route.kind === 'login' || route.kind === 'onboarding'} viewer={dbProfile?.person ?? currentUser.profile} onNavigate={go} onCreate={() => go('/activities/new/local-draft/1')}>{page}</AppShell>
    {joinConfirm && <JoinConfirmDialog activity={joinConfirm} pending={pending?.key === 'join:' + joinConfirm.id} onCancel={() => setJoinConfirm(null)} onConfirm={() => { const activity = joinConfirm; const result = activity.participationMode === ParticipationMode.OPEN_JOIN ? '已确认参加，席位状态已更新' : activity.participationMode === ParticipationMode.MATCH_FORMATION ? '参与意愿已提交，等待匹配成行' : '申请已提交，等待发起者审核'; void mutate('join:' + activity.id, activity.entityVersion, true, () => { toggleJoined(activity.id); setJoinConfirm(null); }, result); }}/>}
    {heartEducation && <Modal title="心动只属于你" onClose={() => setHeartEducation(null)}><div className="heart-education"><Heart fill="currentColor"/><p>你的选择仅自己可见；只有对方也对你心动，双方才会收到通知并开启会话。</p><span>心动不等于报名，也不会绕过双方同意。</span></div><button className="primary-button" onClick={confirmHeart}>知道了，继续心动</button><button className="text-button" onClick={() => setHeartEducation(null)}>暂不操作</button></Modal>}
    {topicMatch && <TopicMatchDialog session={topicMatch} onCancel={cancelTopicMatch} onReady={() => setTopicMatch((current) => current ? { ...current, phase: 'matched' } : current)} onEnter={enterTopicMatch}/>} 
    {message && <div className={'toast ' + (route.kind === 'home' ? 'toast--home' : route.kind === 'chat' ? 'toast--chat' : detail ? 'toast--detail' : '')} role="status" aria-live="polite">{message}</div>}
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
