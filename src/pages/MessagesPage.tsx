import { Bell, CalendarDays, HeartHandshake, MessageCircle, ShieldCheck, UsersRound } from 'lucide-react';
import {
  MessageKind,
  ThreadKind,
  type Activity,
  type Message,
  type Person,
  type PersonId,
  type Thread,
  type ThreadId,
  type Topic,
} from '../domain';
import type { MessageCategory } from '../router';
import { EmptyState } from '../components/StatusUI';
import { SafeImage } from '../components/SafeImage';
import { TabBar } from '../components/TabBar';

export type NotificationTone = 'RELATIONSHIP' | 'ACTIVITY' | 'SAFETY' | 'ACCOUNT';

/** Notification is an inbox projection, not a chat message or a Thread. */
export type InboxNotification = {
  readonly id: `notification_${string}`;
  readonly tone: NotificationTone;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly unread: boolean;
  readonly actionLabel?: string;
};

export type MessageRoomType = 'match' | 'activity' | 'discussion';

export interface MessagesPageProps {
  readonly category: MessageCategory;
  readonly threads: readonly Thread[];
  readonly messages: readonly Message[];
  readonly people: readonly Person[];
  readonly activities: readonly Activity[];
  readonly topics: readonly Topic[];
  readonly currentUserId: PersonId;
  readonly notifications?: readonly InboxNotification[];
  readonly onCategoryChange: (category: MessageCategory) => void;
  readonly onOpenThread: (roomType: MessageRoomType, threadId: ThreadId) => void;
  readonly onOpenNotification?: (notification: InboxNotification) => void;
}

const categoryOptions = [
  { value: 'matches', label: '匹配' },
  { value: 'activities', label: '活动' },
  { value: 'notifications', label: '通知' },
] as const;

const notificationMeta: Record<NotificationTone, { label: string; icon: typeof Bell }> = {
  RELATIONSHIP: { label: '关系连接', icon: HeartHandshake },
  ACTIVITY: { label: '活动进展', icon: CalendarDays },
  SAFETY: { label: '安全提醒', icon: ShieldCheck },
  ACCOUNT: { label: '账户通知', icon: Bell },
};

export function roomTypeForThread(thread: Thread): MessageRoomType {
  if (thread.kind === ThreadKind.MATCH) return 'match';
  if (thread.kind === ThreadKind.ACTIVITY) return 'activity';
  return 'discussion';
}

export function MessagesPage({
  category,
  threads,
  messages,
  people,
  activities,
  topics,
  currentUserId,
  notifications = [],
  onCategoryChange,
  onOpenThread,
  onOpenNotification,
}: MessagesPageProps) {
  const visibleThreads = threads
    .filter((thread) => category === 'activities'
      ? thread.kind === ThreadKind.ACTIVITY
      : thread.kind === ThreadKind.MATCH || thread.kind === ThreadKind.TOPIC_DISCUSSION)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const unreadCount = category === 'notifications'
    ? notifications.filter((item) => item.unread).length
    : visibleThreads.reduce((total, thread) => total + thread.unreadCount, 0);

  return (
    <section className="page inner-page messages-page screen-enter" aria-labelledby="messages-title" data-screen-label="消息列表">
      <header className="simple-header">
        <div><small>活动与真实连接</small><h1 id="messages-title">消息</h1></div>
        <span className="unread-pill">{unreadCount ? `${unreadCount} 条未读` : '已读完'}</span>
      </header>

      <TabBar
        className="message-tabs"
        label="消息分类"
        options={categoryOptions}
        value={category}
        onChange={onCategoryChange}
      />

      {category === 'notifications' ? (
        <NotificationList notifications={notifications} onOpen={onOpenNotification} />
      ) : visibleThreads.length ? (
        <div className="thread-list" role="list">
          {visibleThreads.map((thread) => (
            <div role="listitem" key={thread.id}>
              <ThreadRow
                thread={thread}
                messages={messages}
                people={people}
                activities={activities}
                topics={topics}
                currentUserId={currentUserId}
                onOpen={() => onOpenThread(roomTypeForThread(thread), thread.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={category === 'matches' ? '还没有新的连接' : '还没有活动会话'}
          description={category === 'matches'
            ? '双方都表达意愿，或加入一次限时话题讨论后，会话才会出现在这里。'
            : '只有确认参与并取得房间权限的活动，才会显示活动会话。'}
        />
      )}
    </section>
  );
}

function ThreadRow({
  thread,
  messages,
  people,
  activities,
  topics,
  currentUserId,
  onOpen,
}: {
  thread: Thread;
  messages: readonly Message[];
  people: readonly Person[];
  activities: readonly Activity[];
  topics: readonly Topic[];
  currentUserId: PersonId;
  onOpen: () => void;
}) {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const lastMessage = [...thread.messageIds].reverse()
    .map((id) => messageById.get(id))
    .find((message): message is Message => Boolean(message));
  const visual = getThreadVisual(thread, people, activities, topics, currentUserId);
  const subtitle = lastMessage ? messagePreview(lastMessage, people, currentUserId) : visual.fallback;

  return (
    <button
      type="button"
      className="thread"
      onClick={onOpen}
      aria-label={`打开${thread.title}，${thread.unreadCount} 条未读`}
    >
      <SafeImage src={visual.image} alt="" ratio="1 / 1" fallbackLabel={visual.badge} />
      <div>
        <span className="thread-kicker">{visual.badge}</span>
        <strong>{thread.title}</strong>
        <p>{subtitle}</p>
      </div>
      <aside>
        <time dateTime={thread.updatedAt}>{relativeTime(thread.updatedAt)}</time>
        {thread.unreadCount > 0 && <span aria-label={`${thread.unreadCount} 条未读`}>{thread.unreadCount}</span>}
      </aside>
    </button>
  );
}

function NotificationList({
  notifications,
  onOpen,
}: {
  notifications: readonly InboxNotification[];
  onOpen?: (notification: InboxNotification) => void;
}) {
  if (!notifications.length) {
    return <EmptyState title="暂时没有新通知" description="资料审核、活动状态和安全提醒会集中出现在这里。" />;
  }

  return (
    <div className="thread-list notification-list" role="list">
      {[...notifications]
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .map((notification) => {
          const meta = notificationMeta[notification.tone];
          const Icon = meta.icon;
          const content = (
            <>
              <span className="notification-icon"><Icon size={19} /></span>
              <div>
                <span>{meta.label}{notification.unread ? ' · 未读' : ''}</span>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
                {notification.actionLabel && <small>{notification.actionLabel} →</small>}
              </div>
              <time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time>
            </>
          );
          return (
            <div key={notification.id} role="listitem">
              {onOpen ? (
                <button type="button" className="system-note notification-row" onClick={() => onOpen(notification)}>
                  {content}
                </button>
              ) : (
                <article className="system-note notification-row">{content}</article>
              )}
            </div>
          );
        })}
    </div>
  );
}

function getThreadVisual(
  thread: Thread,
  people: readonly Person[],
  activities: readonly Activity[],
  topics: readonly Topic[],
  currentUserId: PersonId,
) {
  if (thread.kind === ThreadKind.ACTIVITY) {
    const activity = activities.find((item) => item.id === thread.activityId);
    return { image: activity?.cover.url, badge: '活动房间', fallback: '活动房间已经开启' };
  }
  if (thread.kind === ThreadKind.TOPIC_DISCUSSION) {
    const topic = topics.find((item) => item.id === thread.topicId);
    return { image: topic?.cover.url, badge: '限时讨论', fallback: '从一个具体问题开始聊' };
  }
  const counterpartId = thread.participantIds.find((id) => id !== currentUserId);
  const counterpart = people.find((person) => person.id === counterpartId);
  return { image: counterpart?.photos[0].url, badge: '双向连接', fallback: '你们可以开始聊天了' };
}

function messagePreview(message: Message, people: readonly Person[], currentUserId: PersonId) {
  if (message.kind !== MessageKind.TEXT) return message.text;
  if (message.senderId === currentUserId) return `你：${message.text}`;
  const sender = people.find((person) => person.id === message.senderId);
  return sender ? `${sender.displayName}：${message.text}` : message.text;
}

function relativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const dayDifference = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDifference === 1) return '昨天';
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
