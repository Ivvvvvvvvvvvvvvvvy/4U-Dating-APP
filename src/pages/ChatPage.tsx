import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, CircleAlert, MessageCircle, Radio, Send, ShieldCheck, UsersRound } from 'lucide-react';
import {
  DiscussionContinueDecision,
  MessageDeliveryStatus,
  MessageKind,
  ThreadAction,
  ThreadKind,
  type Message,
  type Person,
  type PersonId,
  type StructuredPromptMessage,
  type Thread,
  type ThreadId,
  type Topic,
} from '../domain';
import type { DiscussionRuntime } from '../topicMatch';
import type { MessageRoomType } from './MessagesPage';
import { randomId } from '../randomId';
import { Modal } from '../components/Modal';
import { SafeImage } from '../components/SafeImage';

export type ChatTransport = 'WS' | 'SSE' | 'POLLING';
export type ChatConnectionPhase = 'CONNECTING' | 'LIVE' | 'DEGRADED' | 'OFFLINE';
export type DiscussionEndReason = 'PROFILE_PREFERENCE' | 'RELATIONSHIP_PACE' | 'LIFESTYLE' | 'VALUES_BOUNDARIES' | 'COMMUNICATION_STYLE' | 'TOPIC_RELEVANCE';
export type ChatReportReason = 'HARASSMENT' | 'FRAUD' | 'SEXUAL_CONTENT' | 'HATE_OR_THREAT' | 'PRIVACY' | 'OTHER';
export type ChatReportSubject = { readonly type: 'THREAD' } | { readonly type: 'PERSON'; readonly personId: PersonId };
export interface ChatReportRequest {
  readonly threadId: ThreadId;
  readonly subject: ChatReportSubject;
  readonly reason: ChatReportReason;
  readonly detail: string;
  readonly blockAfterReport: boolean;
}

const discussionEndReasons: readonly { value: DiscussionEndReason; label: string; hint: string }[] = [
  { value: 'PROFILE_PREFERENCE', label: '基本条件不符合偏好', hint: '年龄、城市、职业或外形等' },
  { value: 'RELATIONSHIP_PACE', label: '关系目标或发展节奏不一致', hint: '长期关系、认真了解或推进速度' },
  { value: 'LIFESTYLE', label: '兴趣与生活方式差异较大', hint: '作息、消费习惯、周末安排等' },
  { value: 'VALUES_BOUNDARIES', label: '价值观或关系边界不合适', hint: '家庭、金钱、忠诚或异性交往等' },
  { value: 'COMMUNICATION_STYLE', label: '聊天方式不合拍', hint: '主动程度、回复节奏或表达方式' },
  { value: 'TOPIC_RELEVANCE', label: '这个话题没帮助我了解对方', hint: '本次话题与互动体验不够相关' },
];

const chatReportReasons: readonly { value: ChatReportReason; label: string; hint: string }[] = [
  { value: 'HARASSMENT', label: '骚扰或持续冒犯', hint: '反复联系、辱骂、施压或让你感到不适' },
  { value: 'FRAUD', label: '疑似诈骗或虚假身份', hint: '诱导转账、虚构经历、营销或导流' },
  { value: 'SEXUAL_CONTENT', label: '不当性内容', hint: '未经同意发送露骨内容或提出性要求' },
  { value: 'HATE_OR_THREAT', label: '仇恨、威胁或暴力', hint: '歧视性表达、人身威胁或暴力暗示' },
  { value: 'PRIVACY', label: '泄露隐私或跟踪', hint: '索要、传播私人信息或线下跟踪' },
  { value: 'OTHER', label: '其他安全问题', hint: '请在补充说明中描述具体情况' },
];

export interface ChatConnectionState {
  /** Transport currently carrying server events. */
  readonly transport: ChatTransport;
  readonly phase: ChatConnectionPhase;
  /** Ordered attempts made for this connection, e.g. WS then SSE then POLLING. */
  readonly attempted: readonly ChatTransport[];
  readonly lastReceivedSeq: number;
  readonly pollingIntervalSeconds?: number;
}

export interface SendMessageRequest {
  readonly threadId: ThreadId;
  readonly text: string;
  readonly clientMessageId: `client_${string}`;
  readonly afterSeq: number;
}

export interface ChatPageProps {
  readonly roomType: MessageRoomType;
  readonly thread: Thread;
  readonly messages: readonly Message[];
  readonly people: readonly Person[];
  readonly currentUserId: PersonId;
  readonly connection: ChatConnectionState;
  readonly onBack: () => void;
  readonly onSend: (request: SendMessageRequest) => void | Promise<void>;
  readonly onContinue: () => void;
  readonly onFinish: () => void;
  readonly onReport: (request: ChatReportRequest) => void;
  readonly conversationEnded?: boolean;
  readonly onOpenContext?: (thread: Thread) => void;
  readonly discussionRoom?: {
    readonly topic: Topic;
    readonly runtime: DiscussionRuntime;
    readonly partner?: Person;
    readonly onNextPrompt: (prompt: Pick<StructuredPromptMessage, 'promptStage' | 'text'>) => void;
    readonly onContinue: () => void;
    readonly onLeave: () => void;
  };
}

export function ChatPage({
  roomType,
  thread,
  messages,
  people,
  currentUserId,
  connection,
  onBack,
  onSend,
  onContinue,
  onFinish,
  onReport,
  conversationEnded = false,
  onOpenContext,
  discussionRoom,
}: ChatPageProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [finishSurveyOpen, setFinishSurveyOpen] = useState(false);
  const [finishReasons, setFinishReasons] = useState<DiscussionEndReason[]>([]);
  const [finishNote, setFinishNote] = useState('');
  const [continued, setContinued] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ChatReportReason | null>(null);
  const [reportSubject, setReportSubject] = useState<ChatReportSubject | null>(null);
  const [reportDetail, setReportDetail] = useState('');
  const [blockAfterReport, setBlockAfterReport] = useState(true);
  const [reportReview, setReportReview] = useState(false);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);
  const orderedMessages = useMemo(() => orderMessages(thread, messages), [thread, messages]);
  const visibleMessages = useMemo(() => discussionRoom
    ? orderedMessages.filter(({ message }) => ![
      MessageKind.SYSTEM,
      MessageKind.STRUCTURED_PROMPT,
      MessageKind.ICEBREAKER_SUGGESTION,
    ].includes(message.kind))
    : orderedMessages, [discussionRoom, orderedMessages]);
  const ended = conversationEnded || Boolean(discussionRoom && [
    DiscussionContinueDecision.FINISH,
    DiscussionContinueDecision.LEFT_TEMPORARILY,
    DiscussionContinueDecision.REPORTED,
    DiscussionContinueDecision.BLOCKED,
  ].includes(discussionRoom.runtime.myDecision));
  const canSend = thread.allowedActions.includes(ThreadAction.SEND_MESSAGE) && !ended;
  const isOffline = connection.phase === 'OFFLINE';
  const reportablePeople = thread.participantIds
    .filter((personId) => personId !== currentUserId)
    .flatMap((personId) => {
      const person = people.find((item) => item.id === personId);
      return person ? [person] : [];
    });
  const canReport = thread.allowedActions.includes(ThreadAction.REPORT);
  const canFinish = thread.kind === ThreadKind.MATCH
    ? thread.allowedActions.includes(ThreadAction.UNMATCH)
    : thread.allowedActions.includes(ThreadAction.LEAVE);
  const continueSelected = continued || discussionRoom?.runtime.unlocked || discussionRoom?.runtime.myDecision === DiscussionContinueDecision.CONTINUE;
  const continueConversation = () => {
    if (discussionRoom) discussionRoom.onContinue();
    else onContinue();
    setContinued(true);
  };
  const finishConversation = () => {
    onFinish();
  };
  const closeReport = () => {
    setReportOpen(false);
    setReportReview(false);
    setReportReason(null);
    setReportSubject(null);
    setReportDetail('');
    setBlockAfterReport(true);
  };
  const submitReport = () => {
    if (!reportReason || !reportSubject) return;
    const request = { threadId: thread.id, subject: reportSubject, reason: reportReason, detail: reportDetail.trim(), blockAfterReport };
    localStorage.setItem(`4u:rfc:chat-report:${thread.id}:${Date.now()}`, JSON.stringify({
      ...request,
      createdAt: new Date().toISOString(),
    }));
    closeReport();
    onReport(request);
  };
  const openReport = () => {
    const defaultPerson = thread.kind === ThreadKind.ACTIVITY ? undefined : reportablePeople[0];
    setReportSubject(defaultPerson ? { type: 'PERSON', personId: defaultPerson.id } : null);
    setReportOpen(true);
  };
  const trimmedDraft = draft.trim();
  const submit = async () => {
    if (!trimmedDraft || submitting || !canSend || isOffline) return;
    setSubmitting(true);
    setLocalError('');
    try {
      await onSend({
        threadId: thread.id,
        text: trimmedDraft,
        clientMessageId: `client_${randomId()}`,
        afterSeq: connection.lastReceivedSeq,
      });
      setDraft('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '发送失败，内容已为你保留');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={'page chat-page screen-enter' + (discussionRoom ? ' chat-page--discussion' : '')} aria-labelledby="chat-title" data-room-type={roomType} data-screen-label="聊天详情">
      <header className="chat-header">
        <button type="button" className="icon-button" aria-label="返回消息列表" onClick={onBack}><ArrowLeft size={21} /></button>
        <div>
          <span>{discussionRoom ? (discussionRoom.runtime.unlocked ? '已继续认识' : '话题聊天') : roomLabel(thread)}</span>
          <h1 id="chat-title">{discussionRoom?.partner && !discussionRoom.runtime.unlocked
            ? `${discussionRoom.partner.displayName} · ${discussionRoom.partner.age}岁`
            : thread.title}</h1>
        </div>
        {onOpenContext ? (
          <button type="button" className="icon-button" aria-label="查看会话关联内容" onClick={() => onOpenContext(thread)}><ChevronRight size={21} /></button>
        ) : <span aria-hidden="true" />}
      </header>

      <ConnectionStrip connection={connection} />

      {!discussionRoom && <div className="chat-safety-note" role="note">
        <ShieldCheck size={16} />
        <span>{thread.kind === ThreadKind.ACTIVITY
          ? '活动房间只对有权限的参与者开放；集合细节仍按活动权限控制。'
          : '不合适时可以停止会话、拉黑或举报；平台不会代你发送建议内容。'}</span>
      </div>}

      <main className="message-stream" aria-live="polite">
        {discussionRoom && !discussionRoom.runtime.unlocked && (
          <p className="discussion-inline-note">先聊聊吧，双方同意后会解锁完整资料</p>
        )}
        {discussionRoom?.runtime.unlocked && discussionRoom.partner && (
          <UnlockedProfileCard person={discussionRoom.partner} />
        )}
        {visibleMessages.length ? visibleMessages.map(({ message, seq }) => (
          <MessageBubble
            key={message.id}
            message={message}
            seq={seq}
            currentUserId={currentUserId}
            people={people}
          />
        )) : (
          <div className="state-card state-card--empty"><MessageCircle /><h2>从一句真诚的话开始</h2><p>写下想说的话，发送前仅你可见。</p></div>
        )}
      </main>

      <footer className="chat-composer">
        {!ended && (
          <div className="discussion-tools">
            <div className="discussion-end-actions">
              <button type="button" className="primary-button" disabled={continueSelected || !canSend} onClick={continueConversation}>
                {continueSelected ? '已选择继续' : '继续认识'}
              </button>
              <button type="button" className="text-button" disabled={!canFinish} onClick={() => setFinishSurveyOpen(true)}>结束讨论</button>
              <button type="button" className="text-button report-action" disabled={!canReport} onClick={openReport}>举报</button>
            </div>
          </div>
        )}
        {localError && <p className="composer-error" role="alert"><CircleAlert size={14} />{localError}</p>}
        {!canSend && <p className="composer-status">这个会话当前为只读</p>}
        {isOffline && <p className="composer-status">离线时不会排队发送，请联网后重试</p>}
        <label htmlFor={`draft-${thread.id}`}>
          <span className="sr-only">消息草稿</span>
          <textarea
            id={`draft-${thread.id}`}
            value={draft}
            maxLength={1000}
            rows={1}
            placeholder={canSend ? '写下你想亲自发送的话…' : '会话已关闭'}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <div className="composer-actions">
          <small>未发送 · 仅你可见 · {draft.length}/1000</small>
          <button
            type="button"
            className="primary-button"
            disabled={!trimmedDraft || submitting || !canSend || isOffline}
            onClick={submit}
          >
            <Send size={17} />{submitting ? '发送中…' : '发送'}
          </button>
        </div>
      </footer>
      {finishSurveyOpen && (
        <Modal title="为什么结束这次讨论？" onClose={() => setFinishSurveyOpen(false)}>
          <p className="finish-survey-intro">选择最主要的原因（最多 3 项）。反馈不会展示给对方，会用于优化下一次匹配的人选和话题。</p>
          <div className="finish-survey-options" role="group" aria-label="结束讨论的原因">
            {discussionEndReasons.map((reason) => (
              <button
                key={reason.value}
                type="button"
                role="checkbox"
                aria-checked={finishReasons.includes(reason.value)}
                className={finishReasons.includes(reason.value) ? 'is-selected' : ''}
                onClick={() => setFinishReasons((current) => current.includes(reason.value)
                  ? current.filter((item) => item !== reason.value)
                  : current.length < 3 ? [...current, reason.value] : current)}
              >
                <i aria-hidden="true" />
                <span><strong>{reason.label}</strong><small>{reason.hint}</small></span>
              </button>
            ))}
          </div>
          <label className="finish-survey-note">
            <span>下一次更希望遇到什么样的人？</span>
            <textarea
              value={finishNote}
              rows={3}
              maxLength={200}
              placeholder="例如：希望对方更主动一些，住得近，周末也喜欢户外活动…"
              onChange={(event) => setFinishNote(event.target.value)}
            />
            <small>{finishNote.length}/200 · 选填</small>
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!finishReasons.length && !finishNote.trim()}
            onClick={() => {
              if (!finishReasons.length && !finishNote.trim()) return;
              localStorage.setItem(`4u:rfc:discussion-feedback:${thread.id}`, JSON.stringify({
                topicId: discussionRoom?.topic.id,
                partnerId: discussionRoom?.partner?.id,
                reasons: finishReasons,
                note: finishNote.trim(),
                createdAt: new Date().toISOString(),
              }));
              finishConversation();
            }}
          >提交并结束讨论</button>
          <button type="button" className="text-button" onClick={() => setFinishSurveyOpen(false)}>继续聊聊</button>
        </Modal>
      )}
      {reportOpen && (
        <Modal title={reportReview ? '确认提交举报？' : '举报这次会话'} onClose={closeReport} className="report-dialog">
          {!reportReview ? <>
            <p className="finish-survey-intro">请选择最符合的安全问题。举报内容不会展示给对方，紧急危险请优先联系当地警方。</p>
            <div className="report-subject-options" role="radiogroup" aria-label="举报对象">
              {thread.kind === ThreadKind.ACTIVITY && <button type="button" role="radio" aria-checked={reportSubject?.type === 'THREAD'} className={reportSubject?.type === 'THREAD' ? 'is-selected' : ''} onClick={() => setReportSubject({ type: 'THREAD' })}>整个活动会话</button>}
              {reportablePeople.map((person) => <button key={person.id} type="button" role="radio" aria-checked={reportSubject?.type === 'PERSON' && reportSubject.personId === person.id} className={reportSubject?.type === 'PERSON' && reportSubject.personId === person.id ? 'is-selected' : ''} onClick={() => setReportSubject({ type: 'PERSON', personId: person.id })}>成员：{person.displayName}</button>)}
            </div>
            <div className="report-reason-options" role="radiogroup" aria-label="举报原因">
              {chatReportReasons.map((reason) => <button key={reason.value} type="button" role="radio" aria-checked={reportReason === reason.value} className={reportReason === reason.value ? 'is-selected' : ''} onClick={() => setReportReason(reason.value)}><i aria-hidden="true"/><span><strong>{reason.label}</strong><small>{reason.hint}</small></span></button>)}
            </div>
            <label className="finish-survey-note"><span>补充说明</span><textarea value={reportDetail} maxLength={300} rows={3} placeholder="请描述发生了什么；无需填写身份证、电话等敏感信息" onChange={(event) => setReportDetail(event.target.value)}/><small>{reportDetail.length}/300 · 选填</small></label>
            <label className="report-block-option"><input type="checkbox" checked={blockAfterReport} onChange={(event) => setBlockAfterReport(event.target.checked)}/><span><strong>{reportSubject?.type === 'THREAD' ? '举报后同时退出活动会话' : '举报后同时停止接收该成员消息'}</strong><small>之后可在安全设置中管理</small></span></label>
            <button type="button" className="primary-button" disabled={!reportReason || !reportSubject} onClick={() => setReportReview(true)}>下一步</button>
            <button type="button" className="text-button" onClick={closeReport}>取消</button>
          </> : <>
            <section className="report-review"><ShieldCheck/><div><strong>{chatReportReasons.find((item) => item.value === reportReason)?.label}</strong><p>{reportDetail.trim() || '未填写补充说明'}</p><small>{blockAfterReport ? '提交后将停止接收对方消息' : '提交后仍可接收对方消息'}</small></div></section>
            <button type="button" className="primary-button" onClick={submitReport}>确认举报并结束会话</button>
            <button type="button" className="text-button" onClick={() => setReportReview(false)}>返回修改</button>
          </>}
        </Modal>
      )}
    </section>
  );
}

function ConnectionStrip({ connection }: { connection: ChatConnectionState }) {
  const phaseLabel = connection.phase === 'LIVE'
    ? '连接正常'
    : connection.phase === 'DEGRADED'
      ? '连接较慢，消息仍会同步'
      : connection.phase === 'CONNECTING'
        ? '正在连接'
        : '连接已断开';

  return (
    <section className={`connection-strip connection-strip--${connection.phase.toLowerCase()}`} aria-label="消息连接状态" role="status">
      <Radio size={15} />
      <strong>{phaseLabel}</strong>
    </section>
  );
}

function MessageBubble({
  message,
  seq,
  currentUserId,
  people,
}: {
  message: Message;
  seq: number;
  currentUserId: PersonId;
  people: readonly Person[];
}) {
  const isMine = message.senderId === currentUserId;
  const sender = message.senderId ? people.find((person) => person.id === message.senderId) : undefined;
  const isService = message.senderId === null;

  if (isService) {
    return (
      <article className={`message-event message-event--${message.kind.toLowerCase()}`} data-seq={seq}>
        <MessageKindIcon kind={message.kind} />
        <div><strong>{messageKindLabel(message.kind)}</strong><p>{message.text}</p></div>
        <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
      </article>
    );
  }

  return (
    <article className={`message-bubble ${isMine ? 'message-bubble--mine' : 'message-bubble--theirs'}`} data-seq={seq}>
      <header>
        <span>{isMine ? '你' : sender?.displayName ?? '会话成员'}</span>
      </header>
      <p>{message.text}</p>
      <footer>
        <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
        {isMine && <span>{deliveryLabel(message.deliveryStatus)}</span>}
      </footer>
    </article>
  );
}

function MessageKindIcon({ kind }: { kind: MessageKind }) {
  if (kind === MessageKind.ACTIVITY_UPDATE) return <CalendarDays size={17} />;
  if (kind === MessageKind.STRUCTURED_PROMPT) return <UsersRound size={17} />;
  return <ShieldCheck size={17} />;
}

function orderMessages(thread: Thread, messages: readonly Message[]) {
  const byId = new Map(messages.filter((message) => message.threadId === thread.id).map((message) => [message.id, message]));
  const canonical = thread.messageIds.flatMap((id) => {
    const message = byId.get(id);
    if (!message) return [];
    byId.delete(id);
    return [message];
  });
  const appended = [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return [...canonical, ...appended].map((message, index) => ({ message, seq: index + 1 }));
}

function UnlockedProfileCard({ person }: { person: Person }) {
  return (
    <section className="unlocked-profile-card" aria-label={`${person.displayName}的个人卡片`}>
      <SafeImage src={person.photos[0].url} alt={person.displayName} ratio="4 / 5" fallbackLabel="头像" />
      <div>
        <span>双方已同意继续认识 · 资料已解锁</span>
        <h2>{person.displayName}，{person.age}岁</h2>
        <p>{person.city} · {person.occupation} · {person.mbti}</p>
        <blockquote>{person.bio}</blockquote>
        <div className="unlocked-profile-tags">
          {person.interests.slice(0, 3).map((interest) => <i key={interest}>{interest}</i>)}
        </div>
      </div>
    </section>
  );
}

function roomLabel(thread: Thread) {
  if (thread.kind === ThreadKind.MATCH) return '匹配会话';
  if (thread.kind === ThreadKind.ACTIVITY) return '活动房间';
  return '限时话题讨论';
}

function messageKindLabel(kind: MessageKind) {
  if (kind === MessageKind.ICEBREAKER_SUGGESTION) return '可选破冰建议';
  if (kind === MessageKind.STRUCTURED_PROMPT) return '讨论提示';
  if (kind === MessageKind.ACTIVITY_UPDATE) return '活动更新';
  return '系统消息';
}

function deliveryLabel(status: MessageDeliveryStatus) {
  if (status === MessageDeliveryStatus.READ) return '已读';
  if (status === MessageDeliveryStatus.DELIVERED) return '已送达';
  if (status === MessageDeliveryStatus.FAILED) return '发送失败';
  return '已发送';
}

function messageTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
