import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Flag, MessageCircle, PenLine, Radio } from 'lucide-react';
import {
  DiscussionMatchMode,
  TopicKind,
  type Topic,
  type TopicVoteRecord,
} from '../domain';
import { topicOnlineCount } from '../topicMatch';
import {
  isPersonalExpression,
  matchModeCopy,
  topicGenreLabel,
} from '../topicVote';
import { useDetailFocus } from './detailFocus';

const matchEntries = [
  DiscussionMatchMode.SAME_POSITION_SAME_REASON,
  DiscussionMatchMode.SAME_POSITION_DIFFERENT_REASON,
  DiscussionMatchMode.DIFFERENT_POSITION_SHARED_VALUE,
] as const;

export function TopicDetail({
  topic,
  vote,
  online = true,
  matching = false,
  onBack,
  onSaveVote,
  onStartDiscussion,
}: {
  topic: Topic;
  vote?: TopicVoteRecord;
  online?: boolean;
  matching?: boolean;
  onBack: () => void;
  onSaveVote: (vote: TopicVoteRecord) => void;
  onStartDiscussion: (mode: DiscussionMatchMode, vote?: TopicVoteRecord) => void;
}) {
  useDetailFocus('topic-detail-title');
  if (topic.kind === TopicKind.RELATIONSHIP_SCENARIO) {
    return (
      <RelationshipTopicDetail
        topic={topic}
        vote={vote}
        online={online}
        matching={matching}
        onBack={onBack}
        onSaveVote={onSaveVote}
        onStartDiscussion={onStartDiscussion}
      />
    );
  }
  return (
    <LifestyleTopicDetail
      topic={topic}
      online={online}
      matching={matching}
      onBack={onBack}
      onJoin={() => onStartDiscussion(DiscussionMatchMode.SAME_POSITION_SAME_REASON)}
    />
  );
}

function RelationshipTopicDetail({
  topic,
  vote,
  online,
  matching,
  onBack,
  onSaveVote,
  onStartDiscussion,
}: {
  topic: Extract<Topic, { kind: TopicKind.RELATIONSHIP_SCENARIO }>;
  vote?: TopicVoteRecord;
  online: boolean;
  matching: boolean;
  onBack: () => void;
  onSaveVote: (vote: TopicVoteRecord) => void;
  onStartDiscussion: (mode: DiscussionMatchMode, vote?: TopicVoteRecord) => void;
}) {
  const [step, setStep] = useState<'stage1' | 'stage2' | 'result'>(vote ? 'result' : 'stage1');
  const [positionId, setPositionId] = useState(vote?.positionId ?? '');
  const [primaryReasonId, setPrimaryReasonId] = useState(vote?.primaryReasonId ?? '');
  const [secondaryReasonIds, setSecondaryReasonIds] = useState<string[]>([...(vote?.secondaryReasonIds ?? [])]);
  const reasons = topic.reasonOptionsByPosition[positionId] ?? [];
  const liveCount = topicOnlineCount(topic);
  const currentVote = useMemo<TopicVoteRecord | undefined>(() => {
    if (!positionId) return vote;
    return {
      topicId: topic.id,
      positionId,
      primaryReasonId: primaryReasonId || undefined,
      secondaryReasonIds,
      otherReason: undefined,
      skippedStage2: !primaryReasonId,
    };
  }, [positionId, primaryReasonId, secondaryReasonIds, topic.id, vote]);

  const commitResult = (next: TopicVoteRecord) => {
    onSaveVote(next);
    setStep('result');
  };

  const choosePosition = (id: string) => {
    setPositionId(id);
    setPrimaryReasonId('');
    setSecondaryReasonIds([]);
    setStep('stage2');
  };

  const chooseReason = (id: string) => {
    setPrimaryReasonId(id);
    setSecondaryReasonIds([]);
  };

  const positionLabel = topic.positionOptions.find((option) => option.id === (currentVote?.positionId ?? positionId))?.label;
  const reasonLabel = reasons.find((option) => option.id === (currentVote?.primaryReasonId ?? primaryReasonId))?.label;
  const positionShare = currentVote ? topic.resultStats.positionShares[currentVote.positionId] ?? 0 : 0;
  const reasonShare = currentVote?.primaryReasonId
    ? topic.resultStats.reasonSharesByPosition[currentVote.positionId]?.[currentVote.primaryReasonId] ?? 0
    : 0;

  return (
    <article className={'detail-page detail-page--topic' + (step === 'result' ? ' detail-page--topic-actions' : '')} aria-labelledby="topic-detail-title" data-screen-label="话题详情">
      <header className="detail-top">
        <button className="icon-button" onClick={onBack} aria-label="返回"><ArrowLeft /></button>
        <span>关系议题</span>
        <span />
      </header>
      <div className="topic-detail-hero">
        <span># {topic.tags.find((tag) => !tag.startsWith('AI ')) ?? '关系讨论'}</span>
        <h1 id="topic-detail-title" tabIndex={-1}>{topic.title}</h1>
        <p>{topic.summary}</p>
      </div>
      <div className="detail-body">
        <section className="detail-section topic-article">
          <p>{topic.scenario}</p>
        </section>

        {step === 'stage1' && (
          <section className="detail-section topic-vote">
            <h2>你更支持哪种判断？</h2>
            <div className="topic-option-list">
              {topic.positionOptions.map((option) => (
                <button key={option.id} type="button" className="topic-option" onClick={() => choosePosition(option.id)}>{option.label}</button>
              ))}
            </div>
          </section>
        )}

        {step === 'stage2' && (
          <section className="detail-section topic-vote">
            <h2>你最主要的理由是什么？</h2>
            <div className="topic-option-list">
              {reasons.map((option) => {
                const isPrimary = primaryReasonId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={'topic-option' + (isPrimary ? ' is-primary' : '')}
                    onClick={() => chooseReason(option.id)}
                  >
                    <b>{option.label}</b>
                  </button>
                );
              })}
            </div>
            <div className="topic-vote-actions">
              <button type="button" className="primary-button" disabled={!primaryReasonId} onClick={() => currentVote && commitResult({ ...currentVote, skippedStage2: false })}>确认</button>
              <button type="button" className="text-button" onClick={() => setStep('stage1')}>返回</button>
            </div>
          </section>
        )}

        {step === 'result' && currentVote && (
          <>
            <section className="detail-section topic-result">
              <div className="section-title"><h2>投票结果</h2><button type="button" className="text-button topic-edit-vote" onClick={() => setStep('stage1')}>修改选择</button></div>
              <p>
                {Math.round(positionShare * 100)}% 的人选择「{positionLabel}」
                {reasonLabel ? `，其中 ${Math.round(reasonShare * 100)}% 和你一样，最在意「${reasonLabel}」。` : '。你跳过了原因选择，仍可以按立场开聊。'}
              </p>
              <div className="topic-result-bars">
                {topic.positionOptions.map((option) => (
                  <div key={option.id} className={option.id === currentVote.positionId ? 'is-mine' : ''}>
                    <span>{option.label}</span>
                    <i style={{ width: `${Math.round((topic.resultStats.positionShares[option.id] ?? 0) * 100)}%` }} />
                    <b>{Math.round((topic.resultStats.positionShares[option.id] ?? 0) * 100)}%</b>
                  </div>
                ))}
              </div>
              <div className="topic-match-entries">
                <small className={'topic-live-hint ' + (online ? 'is-live' : 'is-offline')}>
                  {online ? <><Radio size={13} /><i aria-hidden="true" />当前 {liveCount} 人在线，按开聊方式匹配</> : '离线时无法匹配'}
                </small>
                {matchEntries.map((mode) => {
                  const copy = matchModeCopy(mode, topic, currentVote);
                  return (
                    <button
                      key={mode}
                      type="button"
                      className="topic-match-entry"
                      disabled={!online || matching}
                      onClick={() => onStartDiscussion(mode, currentVote)}
                    >
                      <strong>{copy.action}</strong>
                      <span>{copy.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <TopicComments
              topicId={topic.id}
              online={online}
              matching={matching}
              onChat={() => onStartDiscussion(DiscussionMatchMode.SAME_POSITION_SAME_REASON, currentVote)}
            />
          </>
        )}
      </div>
    </article>
  );
}

type TopicComment = {
  id: string;
  author: string;
  avatar: string;
  body: string;
  time: string;
  likes: number;
  liked?: boolean;
  replies?: TopicCommentReply[];
};

type TopicCommentReply = {
  id: string;
  author: string;
  avatar: string;
  body: string;
  time: string;
  likes: number;
  liked?: boolean;
  replyTo?: string;
};

const starterComments: TopicComment[] = [
  { id: 'comment-boundary', author: '林川', avatar: '林', body: '我更在意双方有没有提前说清楚边界，规则本身其实可以一起商量。', time: '12 分钟前', likes: 26 },
  { id: 'comment-context', author: '林一', avatar: '林', body: '具体情境也很重要。同一件事在隐瞒和坦诚的前提下，感受会完全不同。', time: '28 分钟前', likes: 14 },
  { id: 'comment-respect', author: 'Nana', avatar: 'N', body: '尊重彼此的不舒服，比争论谁的标准更正确更重要。', time: '1 小时前', likes: 9 },
];

function TopicComments({ topicId, online, matching, onChat }: { topicId: string; online: boolean; matching: boolean; onChat: () => void }) {
  const storageKey = `4u:rfc:topic-comments:${topicId}`;
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; author: string } | null>(null);
  const [comments, setComments] = useState<TopicComment[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TopicComment[] | null;
      return Array.isArray(saved) ? saved : starterComments;
    } catch {
      return starterComments;
    }
  });

  const updateComments = (updater: (current: TopicComment[]) => TopicComment[]) => {
    setComments((current) => {
      const next = updater(current);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const openComposer = (target: { commentId: string; author: string } | null = null) => {
    setReplyingTo(target);
    setDraft('');
    setComposing(true);
  };

  const closeComposer = () => {
    setComposing(false);
    setReplyingTo(null);
    setDraft('');
  };

  const toggleLike = (commentId: string, replyId?: string) => {
    updateComments((current) => current.map((comment) => {
      if (comment.id !== commentId) return comment;
      if (replyId) {
        return {
          ...comment,
          replies: (comment.replies ?? []).map((reply) => reply.id === replyId
            ? { ...reply, liked: !reply.liked, likes: Math.max(0, (reply.likes ?? 0) + (reply.liked ? -1 : 1)) }
            : reply),
        };
      }
      return { ...comment, liked: !comment.liked, likes: Math.max(0, (comment.likes ?? 0) + (comment.liked ? -1 : 1)) };
    }));
  };

  const publish = () => {
    const body = draft.trim();
    if (!body) return;
    if (replyingTo) {
      const reply: TopicCommentReply = {
        id: `reply-${Date.now()}`,
        author: '我',
        avatar: '我',
        body,
        time: '刚刚',
        likes: 0,
        replyTo: replyingTo.author,
      };
      updateComments((current) => current.map((comment) => comment.id === replyingTo.commentId
        ? { ...comment, replies: [...(comment.replies ?? []), reply] }
        : comment));
    } else {
      updateComments((current) => [
        { id: `comment-${Date.now()}`, author: '我', avatar: '我', body, time: '刚刚', likes: 0 },
        ...current,
      ]);
    }
    closeComposer();
  };

  const commentCount = comments.reduce((total, comment) => total + 1 + (comment.replies?.length ?? 0), 0);

  return (
    <>
      <section className="detail-section topic-comments" aria-labelledby="topic-comments-title">
        <h2 id="topic-comments-title">共 {commentCount} 条评论</h2>
        <div className="comments">
          {comments.map((comment) => (
            <article key={comment.id}>
              <span aria-hidden="true">{comment.avatar}</span>
              <div>
                <b>{comment.author}</b>
                <p>{comment.body}</p>
                <footer>
                  <time>{comment.time}</time>
                  <button type="button" onClick={() => openComposer({ commentId: comment.id, author: comment.author })}>回复</button>
                  <button
                    type="button"
                    className={'comment-like' + (comment.liked ? ' is-liked' : '')}
                    aria-label={`${comment.liked ? '取消赞同' : '赞同'} ${comment.author} 的评论`}
                    aria-pressed={Boolean(comment.liked)}
                    onClick={() => toggleLike(comment.id)}
                  >{comment.liked ? '♥' : '♡'} {comment.likes ?? 0}</button>
                </footer>
                {Boolean(comment.replies?.length) && (
                  <div className="comment-replies">
                    {comment.replies?.map((reply) => (
                      <div className="comment-reply" key={reply.id}>
                        <span aria-hidden="true">{reply.avatar}</span>
                        <div>
                          <b>{reply.author}{reply.replyTo ? <em> 回复 @{reply.replyTo}</em> : null}</b>
                          <p>{reply.body}</p>
                          <footer>
                            <time>{reply.time}</time>
                            <button type="button" onClick={() => openComposer({ commentId: comment.id, author: reply.author })}>回复</button>
                            <button
                              type="button"
                              className={'comment-like' + (reply.liked ? ' is-liked' : '')}
                              aria-label={`${reply.liked ? '取消赞同' : '赞同'} ${reply.author} 的回复`}
                              aria-pressed={Boolean(reply.liked)}
                              onClick={() => toggleLike(comment.id, reply.id)}
                            >{reply.liked ? '♥' : '♡'} {reply.likes ?? 0}</button>
                          </footer>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {typeof document !== 'undefined' && createPortal(
        <>
          {composing && (
            <div className="topic-comment-sheet" role="dialog" aria-modal="true" aria-labelledby="topic-comment-sheet-title">
              <header>
                <b id="topic-comment-sheet-title">{replyingTo ? `回复 ${replyingTo.author}` : '发表评论'}</b>
                <button type="button" className="text-button" onClick={closeComposer}>取消</button>
              </header>
              <textarea
                value={draft}
                maxLength={200}
                rows={3}
                autoFocus
                aria-label={replyingTo ? `回复 ${replyingTo.author}` : '发表评论'}
                placeholder={replyingTo ? `回复 @${replyingTo.author}…` : '友善表达你的观点…'}
                onChange={(event) => setDraft(event.target.value)}
              />
              <footer>
                <small>{draft.length}/200</small>
                <button type="button" className="primary-button" disabled={!draft.trim()} onClick={publish}>发表</button>
              </footer>
            </div>
          )}
          <footer className="sticky-action topic-bottom-actions">
            <button type="button" className="topic-comment-trigger" onClick={() => openComposer()}>
              <PenLine size={17} />说点什么…
            </button>
            <button type="button" className="primary-button topic-online-chat" disabled={!online || matching} onClick={onChat}>
              <MessageCircle size={18} />{matching ? '正在匹配…' : '在线开聊'}
            </button>
          </footer>
        </>,
        document.body,
      )}
    </>
  );
}

function LifestyleTopicDetail({
  topic,
  online,
  matching,
  onBack,
  onJoin,
}: {
  topic: Extract<Topic, { kind: TopicKind.LIFESTYLE_PROMPT }>;
  online: boolean;
  matching: boolean;
  onBack: () => void;
  onJoin: () => void;
}) {
  const liveCount = topicOnlineCount(topic);
  const personal = isPersonalExpression(topic);
  return (
    <article className="detail-page detail-page--topic detail-page--topic-actions" aria-labelledby="topic-detail-title" data-screen-label="话题详情">
      <header className="detail-top">
        <button className="icon-button" onClick={onBack} aria-label="返回"><ArrowLeft /></button>
        <span>{topicGenreLabel(topic)}</span>
        <span />
      </header>
      <div className="topic-detail-hero">
        <span># {topic.tags.find((tag) => !tag.startsWith('AI ')) ?? (personal ? '轻松表达' : '生活话题')}</span>
        <h1 id="topic-detail-title" tabIndex={-1}>{topic.title}</h1>
        <p>{topic.summary}</p>
      </div>
      <div className="detail-body">
        <section className="detail-section topic-article">
          <h2>{personal ? '最近想做的事' : '开场问题'}</h2>
          <aside className="topic-opening"><MessageCircle size={16} /><span>{topic.openingQuestion}</span></aside>
        </section>
        <section className="detail-section topic-join-block">
          <button type="button" className="primary-button topic-instant-button" disabled={!online || matching} onClick={onJoin}>
            <MessageCircle size={18} />{matching ? '正在匹配…' : '加入讨论'}
          </button>
          <p className="topic-vote-hint">不要求先看完整照片墙和详细资料。系统优先匹配正在浏览或已选择同一话题的在线用户。</p>
          <small className={'topic-live-hint ' + (online ? 'is-live' : 'is-offline')}>
            {online ? <><Radio size={13} />当前 {liveCount} 人在线</> : '离线时无法匹配'}
          </small>
        </section>
        <section className="safety-panel">
          <Flag />
          <div>
            <h2>先聊，再决定是否认识</h2>
            <p>生活兴趣负责观察两个人怎么互动。只有双方都点击继续认识，才会按隐私设置解锁更多资料。</p>
          </div>
        </section>
      </div>
    </article>
  );
}
