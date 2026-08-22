import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, CircleAlert, MessageCircle, Radio, Send, ShieldCheck, UsersRound } from 'lucide-react';
import {
  DiscussionContinueDecision,
  DiscussionMatchMode,
  MessageDeliveryStatus,
  MessageKind,
  ThreadAction,
  ThreadKind,
  TopicKind,
  type Message,
  type Person,
  type PersonId,
  type StructuredPromptMessage,
  type Thread,
  type ThreadId,
  type Topic,
} from '../domain';
import { ageBand, matchModeCopy, structuredPrompts, voteLabels } from '../topicVote';
import type { DiscussionRuntime } from '../topicMatch';
import type { MessageRoomType } from './MessagesPage';
import { randomId } from '../randomId';

export type ChatTransport = 'WS' | 'SSE' | 'POLLING';
export type ChatConnectionPhase = 'CONNECTING' | 'LIVE' | 'DEGRADED' | 'OFFLINE';

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
  readonly onOpenContext?: (thread: Thread) => void;
  readonly discussionRoom?: {
    readonly topic: Topic;
    readonly runtime: DiscussionRuntime;
    readonly partner?: Person;
    readonly onNextPrompt: (prompt: Pick<StructuredPromptMessage, 'promptStage' | 'text'>) => void;
    readonly onContinue: () => void;
    readonly onFinish: () => void;
    readonly onLeave: () => void;
    readonly onReport: () => void;
  };
}

const transportOrder: readonly ChatTransport[] = ['WS', 'SSE', 'POLLING'];
const transportLabels: Record<ChatTransport, string> = { WS: 'WebSocket', SSE: 'SSE', POLLING: '轮询' };

export function ChatPage({
  roomType,
  thread,
  messages,
  people,
  currentUserId,
  connection,
  onBack,
  onSend,
  onOpenContext,
  discussionRoom,
}: ChatPageProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const orderedMessages = useMemo(() => orderMessages(thread, messages), [thread, messages]);
  const ended = Boolean(discussionRoom && [
    DiscussionContinueDecision.FINISH,
    DiscussionContinueDecision.LEFT_TEMPORARILY,
    DiscussionContinueDecision.REPORTED,
    DiscussionContinueDecision.BLOCKED,
  ].includes(discussionRoom.runtime.myDecision));
  const canSend = thread.allowedActions.includes(ThreadAction.SEND_MESSAGE) && !ended;
  const isOffline = connection.phase === 'OFFLINE';
  const trimmedDraft = draft.trim();
  const nextPrompt = discussionRoom
    ? structuredPrompts(discussionRoom.topic).find((prompt) => !messages.some((message) => message.kind === MessageKind.STRUCTURED_PROMPT && message.promptStage === prompt.stage))
    : undefined;

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
      setLocalError(error instanceof Error ? error.message : '发送没有确认，草稿仍保留在本机');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page chat-page screen-enter" aria-labelledby="chat-title" data-room-type={roomType} data-screen-label="聊天详情">
      <header className="chat-header">
        <button type="button" className="icon-button" aria-label="返回消息列表" onClick={onBack}><ArrowLeft size={21} /></button>
        <div>
          <span>{discussionRoom ? (discussionRoom.runtime.unlocked ? '已继续认识' : '有限资料讨论房') : roomLabel(thread)}</span>
          <h1 id="chat-title">{discussionRoom?.partner && !discussionRoom.runtime.unlocked
            ? `${discussionRoom.partner.displayName} · ${ageBand(discussionRoom.partner.age)}`
            : thread.title}</h1>
        </div>
        {onOpenContext ? (
          <button type="button" className="icon-button" aria-label="查看会话关联内容" onClick={() => onOpenContext(thread)}><ChevronRight size={21} /></button>
        ) : <span aria-hidden="true" />}
      </header>

      <ConnectionStrip connection={connection} />

      <div className="chat-safety-note" role="note">
        <ShieldCheck size={16} />
        <span>{thread.kind === ThreadKind.ACTIVITY
          ? '活动房间只对有权限的参与者开放；集合细节仍按活动权限控制。'
          : thread.kind === ThreadKind.TOPIC_DISCUSSION
            ? '限时 1 对 1 讨论；平台不会代你发送建议内容。不合适可结束、暂时离开或举报。'
            : '不合适时可以停止会话、拉黑或举报；平台不会代你发送建议内容。'}</span>
      </div>
      {discussionRoom && <DiscussionContext room={discussionRoom} threadMode={thread.kind === ThreadKind.TOPIC_DISCUSSION ? thread.matchMode : DiscussionMatchMode.SAME_POSITION_SAME_REASON} />}

      <main className="message-stream" aria-live="polite">
        {orderedMessages.length ? orderedMessages.map(({ message, seq }) => (
          <MessageBubble
            key={message.id}
            message={message}
            seq={seq}
            currentUserId={currentUserId}
            people={people}
          />
        )) : (
          <div className="state-card state-card--empty"><MessageCircle /><h2>从一句真诚的话开始</h2><p>你的输入只保存在当前页面，点击发送后才会提交。</p></div>
        )}
      </main>

      <footer className="chat-composer">
        {discussionRoom && !ended && (
          <div className="discussion-tools">
            {nextPrompt && (
              <button type="button" className="secondary-button" onClick={() => discussionRoom.onNextPrompt({ promptStage: nextPrompt.stage, text: nextPrompt.text })}>
                下一阶段提示：{promptStageLabel(nextPrompt.stage)}
              </button>
            )}
            <div className="discussion-end-actions">
              <button type="button" className="primary-button" disabled={discussionRoom.runtime.myDecision === DiscussionContinueDecision.CONTINUE} onClick={discussionRoom.onContinue}>
                {discussionRoom.runtime.unlocked ? '已双向继续认识' : discussionRoom.runtime.myDecision === DiscussionContinueDecision.CONTINUE ? '已选择继续，等待对方' : '继续认识'}
              </button>
              <button type="button" className="text-button" onClick={discussionRoom.onFinish}>结束讨论</button>
              <button type="button" className="text-button" onClick={discussionRoom.onLeave}>暂时离开</button>
              <button type="button" className="text-button" onClick={discussionRoom.onReport}>不适 / 举报</button>
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
            rows={2}
            placeholder={canSend ? '写下你想亲自发送的话…' : '会话已关闭'}
            disabled={!canSend}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <div className="composer-actions">
          <small>本地草稿 · 不自动发送 · {draft.length}/1000</small>
          <button
            type="button"
            className="primary-button"
            disabled={!trimmedDraft || submitting || !canSend || isOffline}
            onClick={submit}
          >
            <Send size={17} />{submitting ? '发送中…' : '明确发送'}
          </button>
        </div>
      </footer>
    </section>
  );
}

function ConnectionStrip({ connection }: { connection: ChatConnectionState }) {
  const attempted = new Set(connection.attempted);
  const phaseLabel = connection.phase === 'LIVE'
    ? '实时连接'
    : connection.phase === 'DEGRADED'
      ? '已降级，消息仍同步'
      : connection.phase === 'CONNECTING'
        ? '正在连接'
        : '连接已离线';

  return (
    <section className={`connection-strip connection-strip--${connection.phase.toLowerCase()}`} aria-label="消息连接状态" role="status">
      <Radio size={15} />
      <div>
        <strong>{phaseLabel}</strong>
        <span className="transport-path">
          {transportOrder.map((transport, index) => (
            <span key={transport}>
              {index > 0 && <i aria-hidden="true">→</i>}
              <b className={connection.transport === transport ? 'is-active' : attempted.has(transport) ? 'was-attempted' : ''}>{transportLabels[transport]}</b>
            </span>
          ))}
        </span>
      </div>
      <small>seq {String(connection.lastReceivedSeq).padStart(4, '0')}{connection.transport === 'POLLING' && connection.pollingIntervalSeconds ? ` · ${connection.pollingIntervalSeconds}s` : ''}</small>
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
        <span className="message-seq">SEQ {String(seq).padStart(4, '0')}</span>
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
        <b className="message-seq">SEQ {String(seq).padStart(4, '0')}</b>
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

function DiscussionContext({
  room,
  threadMode,
}: {
  room: NonNullable<ChatPageProps['discussionRoom']>;
  threadMode: DiscussionMatchMode;
}) {
  const copy = matchModeCopy(threadMode, room.topic, room.runtime.vote);
  const mine = room.topic.kind === TopicKind.RELATIONSHIP_SCENARIO ? voteLabels(room.topic, room.runtime.vote) : undefined;
  return (
    <section className="discussion-context">
      <strong>{copy.title}</strong>
      <p>
        {room.partner ? `${room.partner.displayName} · ${ageBand(room.partner.age)} · ${room.partner.city}` : '对方资料有限展示'}
        {mine?.position ? ` · 你的立场：${mine.position}` : ''}
        {room.runtime.unlocked ? ' · 双方已同意继续认识' : ' · 完整资料尚未解锁'}
      </p>
    </section>
  );
}

function promptStageLabel(stage: StructuredPromptMessage['promptStage']) {
  if (stage === 'OPENING') return '开场';
  if (stage === 'UNDERSTANDING') return '理解';
  if (stage === 'CONDITION') return '条件';
  if (stage === 'REFLECTION') return '迁移';
  return '收束';
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
