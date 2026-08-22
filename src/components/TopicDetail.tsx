import { useMemo, useState } from 'react';
import { ArrowLeft, Flag, MessageCircle, Radio } from 'lucide-react';
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
    <article className="detail-page detail-page--topic" aria-labelledby="topic-detail-title" data-screen-label="话题详情">
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
          <section className="detail-section topic-result">
            <div className="section-title"><h2>结果与开聊</h2><button type="button" className="text-button topic-edit-vote" onClick={() => setStep('stage1')}>修改选择</button></div>
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
        )}
      </div>
    </article>
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
    <article className="detail-page detail-page--topic" aria-labelledby="topic-detail-title" data-screen-label="话题详情">
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
          <p>{topic.prompt}</p>
          <aside className="topic-opening"><MessageCircle size={16} /><span>{topic.openingQuestion}</span></aside>
        </section>
        <section className="detail-section">
          <p className="topic-vote-hint">不要求先看完整照片墙和详细资料。系统优先匹配正在浏览或已选择同一话题的在线用户。</p>
          <small className={'topic-live-hint ' + (online ? 'is-live' : 'is-offline')}>
            {online ? <><Radio size={13} /><i aria-hidden="true" />当前 {liveCount} 人在线</> : '离线时无法匹配'}
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
      <footer className="sticky-action sticky-action--single">
        <button type="button" className="primary-button topic-instant-button" disabled={!online || matching} onClick={onJoin}>
          <MessageCircle size={18} />{matching ? '正在匹配…' : '加入讨论'}
        </button>
      </footer>
    </article>
  );
}
