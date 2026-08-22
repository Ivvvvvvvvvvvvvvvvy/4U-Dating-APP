import { CalendarIcon, HeartIcon, MapPinIcon } from './Icons';
import type { Activity } from '../data';

type Props = {
  activity: Activity;
  saved: boolean;
  onSave: (id: string) => void;
  onOpen: (activity: Activity) => void;
};

export function ActivityCard({ activity, saved, onSave, onOpen }: Props) {
  const isDuo = activity.kind === 'duo';
  const remaining = activity.maxPeople - activity.confirmed;
  const status = isDuo
    ? remaining === 0 ? '已成行' : '等 1 位同行者'
    : remaining === 0 ? '仅候补' : activity.confirmed >= activity.minPeople ? '已成团' : `差 ${activity.minPeople - activity.confirmed} 人成团`;

  return (
    <article className={`activity-card activity-card--${activity.kind}`}>
      <div className="activity-card__image-wrap">
        <img className="activity-card__image" src={activity.image} alt={activity.title} />
        <span className={`mode-ticket mode-ticket--${activity.kind}`}>{isDuo ? '双人同行' : '多人小组'}</span>
        <button
          className={`icon-button save-button ${saved ? 'is-saved' : ''}`}
          aria-label={saved ? '取消收藏' : '收藏活动'}
          onClick={(event) => { event.stopPropagation(); onSave(activity.id); }}
        >
          <HeartIcon size={19} filled={saved} />
        </button>
        <div className="image-meta">
          <span><CalendarIcon size={13} />{activity.date}</span>
          <span><MapPinIcon size={13} />{activity.district}</span>
        </div>
      </div>
      <div className="activity-card__body">
        <p className="activity-kicker">{activity.kicker}</p>
        <h3>{activity.title}</h3>
        <div className="card-facts">
          <span>{activity.time}</span>
          <i></i>
          <span>{activity.price}</span>
          <i></i>
          <span>{activity.distance}</span>
        </div>
        <div className="member-row">
          <div className="avatar-stack">
            {activity.members.slice(0, 3).map((member) => (
              <img key={member.id} src={member.avatar} alt={member.name} />
            ))}
          </div>
          <span className="capacity">{activity.confirmed}/{activity.maxPeople} · {status}</span>
        </div>
        <div className="match-line">
          <span className="match-pulse"></span>
          <strong>{activity.matchLabel}</strong>
          <span>{activity.matchReason}</span>
        </div>
      </div>
      <button className="card-open-overlay" aria-label={`查看活动：${activity.title}`} onClick={() => onOpen(activity)}></button>
    </article>
  );
}
