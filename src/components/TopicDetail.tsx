import { useMemo, useState } from 'react';
import { ArrowLeft, Flag, MessageCircle, Radio, Sparkles } from 'lucide-react';
import {
  DiscussionMatchMode,
  TopicKind,
  type Topic,
  type TopicVoteRecord,
} from '../domain';
import { topicOnlineCount } from '../topicMatch';
import {
  dimensionLabel,
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
  const [otherReason, setOtherReason] = useState(vote?.otherReason ?? '');
  const reasons = topic.reasonOptionsByPosition[positionId] ?? [];
  const liveCount = topicOnlineCount(topic);
  const currentVote = useMemo<TopicVoteRecord | undefined>(() => {
    if (!positionId) return vote;
    return {
      topicId: topic.id,
      positionId,
      primaryReasonId: primaryReasonId || undefined,
      secondaryReasonIds,
      otherReason: otherReason.trim() || undefined,
      skippedStage2: !primaryReasonId,
    };
  }, [otherReason, positionId, primaryReasonId, secondaryReasonIds, topic.id, vote]);

  const commitResult = (next: TopicVoteRecord) => {
    onSaveVote(next);
    setStep('result');
  };

  const choosePosition = (id: string) => {
    setPositionId(id);
    setPrimaryReasonId('');
    setSecondaryReasonIds([]);
    setOtherReason('');
    setStep('stage2');
  };

  const chooseReason = (id: string) => {
    if (!primaryReasonId || primaryReasonId === id) {
      setPrimaryReasonId(id);
      setSecondaryReasonIds((current) => current.filter((item) => item !== id));
      return;
    }
    setSecondaryReasonIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
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
        <span className="topic-dimension-pill">{dimensionLabel(topic.primaryDimension)}</span>
      </header>
      <div className="topic-detail-hero">
        <span># {topic.tags.find((tag) => !tag.startsWith('AI ')) ?? '关系讨论'}</span>
        <h1 id="topic-detail-title" tabIndex={-1}>{topic.title}</h1>
        <p>{topic.summary}</p>
      </div>
      <div className="detail-body">
        <section className="detail-section topic-article">
          <h2>情景</h2>
          <p>{topic.scenario}</p>
          {topic.reversal && <aside className="topic-reversal"><Sparkles size={15} /><span>可能改变判断的条件：{topic.reversal}</span></aside>}
          <div className="detail-tags">{topic.tags.filter((tag) => !tag.startsWith('AI ')).map((tag) => <span key={tag}>{tag}</span>)}</div>
        </section>

        {step === 'stage1' && (
          <section className="detail-section topic-vote">
            <div className="section-title"><h2>第一次投票：你更支持哪种判断</h2><span>只记录情景立场</span></div>
            <p className="topic-vote-hint">立场不等于择偶要求。选完后会再问一次“为什么”。</p>
            <div className="topic-option-list">
              {topic.positionOptions.map((option) => (
                <button key={option.id} type="button" className="topic-option" onClick={() => choosePosition(option.id)}>{option.label}</button>
              ))}
            </div>
          </section>
        )}

        {step === 'stage2' && (
          <section className="detail-section topic-vote">
            <div className="section-title"><h2>第二次投票：你最主要的理由</h2><span>可跳过</span></div>
            <p className="topic-vote-hint">你选择了「{positionLabel}」。第一次点中的是主因，之后最多再选 2 个次因。</p>
            <div className="topic-option-list">
              {reasons.map((option) => {
                const isPrimary = primaryReasonId === option.id;
                const isSecondary = secondaryReasonIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={'topic-option' + (isPrimary ? ' is-primary' : '') + (isSecondary ? ' is-secondary' : '')}
                    onClick={() => chooseReason(option.id)}
                  >
                    <b>{option.label}</b>
                    <small>{isPrimary ? '最主要原因' : isSecondary ? '也会考虑' : dimensionLabel(option.dimension)}</small>
                  </button>
                );
              })}
            </div>
            <label className="topic-other-reason">
              <span>其他原因（默认不公开）</span>
              <textarea value={otherReason} maxLength={80} rows={2} placeholder="可选，用于完善选项库" onChange={(event) => setOtherReason(event.target.value)} />
            </label>
            <div className="topic-vote-actions">
              <button type="button" className="primary-button" disabled={!primaryReasonId} onClick={() => currentVote && commitResult({ ...currentVote, skippedStage2: false })}>确认并看结果</button>
              <button type="button" className="secondary-button" onClick={() => currentVote && commitResult({ ...currentVote, primaryReasonId: undefined, secondaryReasonIds: [], skippedStage2: true })}>先看结果</button>
              <button type="button" className="text-button" onClick={() => setStep('stage1')}>返回修改立场</button>
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

        <section className="safety-panel">
          <Flag />
          <div>
            <h2>表达服务于认识，不是站队</h2>
            <p>停留只说明关注；投票是情景立场，不是给对方贴标签。即时讨论先展示有限资料，只有双方都选择继续认识，才会进入常规聊天。</p>
          </div>
        </section>
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
