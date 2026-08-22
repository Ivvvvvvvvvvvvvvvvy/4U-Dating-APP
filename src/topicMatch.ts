import {
  DiscussionContinueDecision,
  DiscussionMatchMode,
  MessageDeliveryStatus,
  MessageKind,
  ThreadAction,
  ThreadKind,
  TopicDiscussionStatus,
  TopicKind,
  type ISODateTime,
  type Message,
  type MessageId,
  type Person,
  type PersonId,
  type Thread,
  type ThreadId,
  type Topic,
  type TopicDiscussionThread,
  type TopicVoteRecord,
} from './domain';
import { randomId } from './randomId';
import { structuredPrompts } from './topicVote';

export type TopicMatchSession = {
  readonly topic: Topic;
  readonly partner: Person;
  readonly matchMode: DiscussionMatchMode;
  readonly vote?: TopicVoteRecord;
  readonly existingThread?: TopicDiscussionThread;
  readonly phase: 'searching' | 'matched';
};

export type DiscussionRuntime = {
  readonly threadId: ThreadId;
  readonly topicId: Topic['id'];
  readonly matchMode: DiscussionMatchMode;
  readonly vote?: TopicVoteRecord;
  readonly myDecision: DiscussionContinueDecision;
  readonly partnerDecision: DiscussionContinueDecision;
  readonly unlocked: boolean;
};

const compactId = () => randomId().replaceAll('-', '');

export function topicOnlineCount(topic: Topic) {
  return 2 + (topic.replyCount % 4);
}

export function findActiveTopicDiscussion(
  topicId: Topic['id'],
  matchMode: DiscussionMatchMode,
  allThreads: readonly Thread[],
  currentUserId: PersonId,
): TopicDiscussionThread | undefined {
  return allThreads.find((thread): thread is TopicDiscussionThread => (
    thread.kind === ThreadKind.TOPIC_DISCUSSION
    && thread.topicId === topicId
    && thread.matchMode === matchMode
    && thread.discussionStatus === TopicDiscussionStatus.ACTIVE
    && thread.participantIds.includes(currentUserId)
  ));
}

export function counterpartOf(thread: Thread, currentUserId: PersonId): PersonId | undefined {
  return thread.participantIds.find((id) => id !== currentUserId);
}

export function createTopicDiscussion(
  topic: Topic,
  partner: Person,
  currentUserId: PersonId,
  matchMode: DiscussionMatchMode,
): { thread: TopicDiscussionThread; messages: Message[] } {
  const now = new Date().toISOString() as ISODateTime;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() as ISODateTime;
  const threadId = `thread_topic_live_${compactId()}` as ThreadId;
  const openedId = `message_${compactId()}` as MessageId;
  const promptId = `message_${compactId()}` as MessageId;
  const opening = structuredPrompts(topic)[0];

  const messages: Message[] = [
    {
      id: openedId,
      threadId,
      kind: MessageKind.SYSTEM,
      senderId: null,
      event: 'THREAD_OPENED',
      text: topic.kind === TopicKind.RELATIONSHIP_SCENARIO
        ? `已按所选开聊方式匹配。这是限时 1 对 1 讨论房，先围绕「${topic.title}」交流；双方同意后才会解锁更多资料。`
        : `你们都在看「${topic.title}」。讨论前只展示有限资料，双方同意继续认识后才会进入常规聊天。`,
      createdAt: now,
      deliveryStatus: MessageDeliveryStatus.SENT,
    },
    {
      id: promptId,
      threadId,
      kind: MessageKind.STRUCTURED_PROMPT,
      senderId: null,
      promptStage: opening.stage,
      text: opening.text,
      createdAt: now,
      deliveryStatus: MessageDeliveryStatus.SENT,
    },
  ];

  return {
    thread: {
      id: threadId,
      entityVersion: 1,
      kind: ThreadKind.TOPIC_DISCUSSION,
      title: partner.displayName,
      participantIds: [currentUserId, partner.id],
      messageIds: [openedId, promptId],
      createdAt: now,
      updatedAt: now,
      unreadCount: 0,
      allowedActions: [
        ThreadAction.SEND_MESSAGE,
        ThreadAction.VIEW_TOPIC,
        ThreadAction.LEAVE,
        ThreadAction.BLOCK,
        ThreadAction.REPORT,
      ],
      topicId: topic.id,
      discussionStatus: TopicDiscussionStatus.ACTIVE,
      matchMode,
      expiresAt,
    },
    messages,
  };
}

export function initialDiscussionRuntime(
  thread: TopicDiscussionThread,
  vote?: TopicVoteRecord,
): DiscussionRuntime {
  return {
    threadId: thread.id,
    topicId: thread.topicId,
    matchMode: thread.matchMode,
    vote,
    myDecision: DiscussionContinueDecision.UNDECIDED,
    partnerDecision: DiscussionContinueDecision.UNDECIDED,
    unlocked: false,
  };
}
