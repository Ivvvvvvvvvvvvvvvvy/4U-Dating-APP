import { useState } from 'react';
import { activities } from '../data';

const threads = [
  { id: 1, activity: activities[1], title: '梧桐区 City Walk', message: '陈一：集合点已经更新到 10 号口', time: '10:24', unread: 3 },
  { id: 2, activity: activities[0], title: '同行申请', message: '阿岚已查看你的申请，等待确认', time: '昨天', unread: 1 },
  { id: 3, activity: activities[3], title: '黑胶试听夜', message: '活动已成团，活动房间已开放', time: '周一', unread: 0 },
];

export function MessagesPage({ onOpen }: { onOpen: (activity: typeof activities[number]) => void }) {
  const [section, setSection] = useState<'activity' | 'system'>('activity');
  return (
    <div className="page inner-page screen-enter">
      <div className="simple-header"><div><small>活动与连接</small><h1>消息</h1></div><span className="unread-pill">4 条未读</span></div>
      <div className="message-tabs"><button className={section === 'activity' ? 'is-active' : ''} onClick={() => setSection('activity')}>活动消息</button><button className={section === 'system' ? 'is-active' : ''} onClick={() => setSection('system')}>系统通知</button></div>
      <section className="thread-list">
        {section === 'activity' ? threads.map((thread) => (
          <button key={thread.id} className="thread" onClick={() => onOpen(thread.activity)}>
            <img src={thread.activity.image} alt="" />
            <div><strong>{thread.title}</strong><p>{thread.message}</p></div>
            <aside><time>{thread.time}</time>{thread.unread > 0 && <span>{thread.unread}</span>}</aside>
          </button>
        )) : <><div className="system-note"><span>资料状态</span><strong>真人认证已通过</strong><p>现在可以发起活动，也可以确认参加活动。</p></div><div className="system-note"><span>本周推荐</span><strong>有 4 场活动符合你的时间</strong><p>其中 2 场支持双人同行。</p></div></>}
      </section>
    </div>
  );
}
