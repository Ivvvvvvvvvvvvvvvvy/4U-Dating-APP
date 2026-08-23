import { useEffect } from 'react';
import { MessageCircle, Radio } from 'lucide-react';
import { TopicKind } from '../domain';
import type { TopicMatchSession } from '../topicMatch';
import { matchModeCopy, voteLabels } from '../topicVote';
import { Modal } from './Modal';
import { SafeImage } from './SafeImage';

export function TopicMatchDialog({
  session,
  onCancel,
  onReady,
  onEnter,
}: {
  session: TopicMatchSession;
  onCancel: () => void;
  onReady: () => void;
  onEnter: () => void;
}) {
  useEffect(() => {
    if (session.phase !== 'searching') return;
    const timer = window.setTimeout(onReady, 1800);
    return () => window.clearTimeout(timer);
  }, [onReady, session.phase]);

  const searching = session.phase === 'searching';
  const copy = matchModeCopy(session.matchMode, session.topic, session.vote);
  const partnerVote = session.topic.kind === TopicKind.RELATIONSHIP_SCENARIO && session.vote
    ? voteLabels(session.topic, session.vote)
    : undefined;

  return (
    <Modal
      className="topic-match-dialog"
      title={searching ? '正在匹配在线讨论对象' : '和他聊一聊吧'}
      onClose={onCancel}
    >
      {searching ? (
        <div className="topic-match-searching" role="status" aria-live="polite">
          <span className="topic-match-radar" aria-hidden="true"><i /><i /><i /></span>
          <p>{copy.description}</p>
          <small>优先匹配当前在线、同一话题且符合安全条件的人。不会随机匹配完全相反的观点。</small>
        </div>
      ) : (
        <div className="topic-match-result">
          <div className="topic-match-person topic-match-person--limited">
            <SafeImage
              src={session.partner.photos[0].url}
              alt={session.partner.displayName}
              ratio="1 / 1"
              fallbackLabel="头像"
            />
            <div>
              <span><Radio size={13} />现在在线</span>
              <strong>{session.partner.displayName} · {session.partner.age}岁</strong>
              <p>{session.partner.city} · 当前话题已选择</p>
              {partnerVote?.position && <small>对方将按该开聊方式展示对应立场</small>}
            </div>
          </div>
          <p>{copy.title}。完整照片墙和详细资料默认不展示，只有双方继续认识后才会解锁。</p>
          <div className="privacy-callout">
            <ShieldCheck size={18} />
            <span>匹配成功后由你决定何时进入会话，平台不会代你发送建议内容。</span>
          </div>
          <button className="primary-button" type="button" onClick={onEnter}>
            <MessageCircle size={17} />开始聊天
          </button>
          <button className="text-button" type="button" onClick={onCancel}>先不进入</button>
        </div>
      )}
    </Modal>
  );
}
