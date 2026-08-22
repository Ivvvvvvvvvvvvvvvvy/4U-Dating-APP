import type { Activity, Person } from '../data';
import { ArrowLeftIcon, ChevronRightIcon, ShieldIcon, SparkIcon } from './Icons';

type Props = {
  person: Person;
  activity: Activity;
  onClose: () => void;
  onActivity: (activity: Activity) => void;
};

export function PersonSheet({ person, activity, onClose, onActivity }: Props) {
  return (
    <div className="person-detail screen-enter">
      <div className="person-detail__hero">
        <img src={person.avatar} alt={person.name} />
        <div className="detail-shade"></div>
        <button className="glass-button detail-back" onClick={onClose} aria-label="返回"><ArrowLeftIcon /></button>
        <div className="person-detail__title"><h1>{person.name}，{person.age}</h1><p>{person.bio}</p></div>
      </div>
      <main className="detail-content">
        <section className="detail-section fit-section">
          <div className="section-label"><SparkIcon size={15} />为什么推荐</div>
          <h2>你们有明确的共同生活线索</h2>
          <p>你们都喜欢慢节奏的城市活动，也都对从共同体验开始认识一个人保持开放。</p>
          <div className="tag-row">{person.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </section>
        <section className="detail-section">
          <h2>通过活动自然认识</h2>
          <button className="activity-invite" onClick={() => onActivity(activity)}>
            <img src={activity.image} alt="" />
            <div><span>{activity.kind === 'duo' ? '双人同行' : '多人小组'}</span><strong>{activity.title}</strong><small>{activity.date} · {activity.district}</small></div>
            <ChevronRightIcon size={20} />
          </button>
        </section>
        <section className="safety-note"><ShieldIcon size={21} /><div><strong>活动前不开放私聊</strong><p>参加同一场活动后，再由双方决定是否继续认识。</p></div></section>
      </main>
      <div className="detail-action detail-action--single"><button onClick={() => onActivity(activity)}>查看共同活动</button></div>
    </div>
  );
}
