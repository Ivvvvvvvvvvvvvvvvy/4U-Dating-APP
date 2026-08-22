import { useState } from 'react';
import type { Activity } from '../data';
import { ArrowLeftIcon, CalendarIcon, CheckIcon, ClockIcon, HeartIcon, MapPinIcon, ShieldIcon } from './Icons';

type Props = {
  activity: Activity;
  saved: boolean;
  joined: boolean;
  onBack: () => void;
  onSave: (id: string) => void;
  onJoin: (id: string) => void;
};

export function ActivityDetail({ activity, saved, joined, onBack, onSave, onJoin }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isDuo = activity.kind === 'duo';
  const full = activity.confirmed >= activity.maxPeople;

  const confirmJoin = () => {
    onJoin(activity.id);
    setShowConfirm(false);
  };

  return (
    <div className="detail-view screen-enter">
      <div className="detail-hero">
        <img src={activity.image} alt={activity.title} />
        <div className="detail-shade"></div>
        <button className="glass-button detail-back" onClick={onBack} aria-label="返回"><ArrowLeftIcon /></button>
        <button className={`glass-button detail-save ${saved ? 'is-saved' : ''}`} onClick={() => onSave(activity.id)} aria-label="收藏"><HeartIcon filled={saved} /></button>
        <span className={`detail-mode detail-mode--${activity.kind}`}>{isDuo ? '2 人同行' : `${activity.minPeople} 人成团`}</span>
        <div className="detail-hero-copy">
          <p>{activity.category} · {activity.kicker}</p>
          <h1>{activity.title}</h1>
        </div>
      </div>

      <main className="detail-content">
        <section className="fact-strip">
          <div><CalendarIcon size={19} /><span><b>{activity.date}</b>{activity.time} · {activity.duration}</span></div>
          <div><MapPinIcon size={19} /><span><b>{activity.district}</b>{activity.distance} · 成行后显示集合点</span></div>
        </section>

        <section className="detail-section fit-section">
          <div className="section-label">为什么推荐给你</div>
          <h2>{activity.matchLabel}</h2>
          <p>{activity.matchReason}。你们对活动节奏和周末时间的偏好也比较接近。</p>
          <details className="match-details"><summary>匹配依据与隐私说明</summary><p>推荐基于你主动填写的兴趣、活动时间与公开偏好。平台不会向其他成员展示你的内部匹配结果。</p></details>
        </section>

        <section className="detail-section">
          <div className="section-heading"><h2>一起去的人</h2><span>{activity.confirmed}/{activity.maxPeople}</span></div>
          <div className="people-list">
            {activity.members.map((person, index) => (
              <div className="person-row" key={person.id}>
                <img src={person.avatar} alt={person.name} />
                <div><strong>{person.name}，{person.age}</strong><p>{person.bio}</p></div>
                <span>{index === 0 ? '发起者' : '已确认'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <h2>活动安排</h2>
          <div className="timeline">
            {activity.plan.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}
          </div>
        </section>

        <section className="detail-section">
          <h2>这场活动的感觉</h2>
          <div className="tag-row">{activity.atmosphere.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <p className="detail-description">{activity.description}</p>
        </section>

        <section className="safety-note">
          <ShieldIcon size={21} />
          <div><strong>先一起做喜欢的事</strong><p>{activity.notice}</p></div>
        </section>
      </main>

      <div className="detail-action">
        <div><span>{activity.price}</span><small>预计人均</small></div>
        <button className={joined ? 'joined-button' : ''} onClick={() => !joined && setShowConfirm(true)}>
          {joined ? <><CheckIcon size={18} />申请已提交</> : full ? '加入候补' : isDuo ? '申请同行' : '申请参加'}
        </button>
      </div>

      {showConfirm && (
        <div className="sheet-backdrop" onClick={() => setShowConfirm(false)}>
          <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle"></div>
            <span className={`mini-mode mini-mode--${activity.kind}`}>{isDuo ? '双人同行' : '多人小组'}</span>
            <h2>确认你的参与意愿</h2>
            <p>提交申请后由发起者确认席位。参加活动不代表向任何成员表达好感。</p>
            <div className="confirm-summary">
              <span><CalendarIcon size={17} />{activity.date} {activity.time}</span>
              <span><ClockIcon size={17} />{activity.duration}</span>
              <span><MapPinIcon size={17} />{activity.district}</span>
            </div>
            <button className="primary-wide" onClick={confirmJoin}>确认并提交申请</button>
            <button className="secondary-wide" onClick={() => setShowConfirm(false)}>再想想</button>
          </section>
        </div>
      )}
    </div>
  );
}
