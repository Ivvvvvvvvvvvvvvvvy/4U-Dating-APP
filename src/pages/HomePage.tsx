import { useMemo, useRef, useState } from 'react';
import type { Activity, Person } from '../data';
import { activities, people, topicCards } from '../data';
import { ActivityCard } from '../components/ActivityCard';
import { PersonCard } from '../components/PersonCard';
import { BellIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { SearchPanel } from '../components/SearchPanel';

type PrimaryTab = '推荐' | '活动' | '话题';

const subTabs: Record<PrimaryTab, string[]> = {
  推荐: ['为你', '附近', '本周末', '新加入'],
  活动: ['全部', '双人同行', '多人小组', '展览', '运动', '音乐'],
  话题: ['热门', '找同行', '约会灵感', '安全经验'],
};

type Props = {
  primary: PrimaryTab;
  secondary: Record<PrimaryTab, string>;
  saved: Set<string>;
  onPrimary: (tab: PrimaryTab) => void;
  onSecondary: (tab: PrimaryTab, sub: string) => void;
  onSave: (id: string) => void;
  onOpenActivity: (activity: Activity) => void;
  onOpenPerson: (person: Person, activity: Activity) => void;
  onCreate: () => void;
  onGoMessages: () => void;
};

export function HomePage({ primary, secondary, saved, onPrimary, onSecondary, onSave, onOpenActivity, onOpenPerson, onCreate, onGoMessages }: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [searching, setSearching] = useState(false);

  const filtered = useMemo(() => {
    const sub = secondary[primary];
    if (primary === '推荐') {
      if (sub === '附近') return [...activities].sort((a, b) => Number(a.distance.split(' ')[0]) - Number(b.distance.split(' ')[0]));
      if (sub === '本周末') return activities.slice(0, 2);
      if (sub === '新加入') return [...activities].reverse();
      return activities;
    }
    if (primary !== '活动') return activities;
    if (sub === '双人同行') return activities.filter((item) => item.kind === 'duo');
    if (sub === '多人小组') return activities.filter((item) => item.kind === 'group');
    if (sub === '展览') return activities.filter((item) => item.category === '展览');
    if (sub === '运动') return activities.filter((item) => item.category === '运动');
    if (sub === '音乐') return activities.filter((item) => item.category === '音乐');
    return activities;
  }, [primary, secondary]);
  const visibleTopics = secondary.话题 === '热门' ? topicCards : topicCards.filter((topic) => topic.tag === secondary.话题);

  return (
    <div className="page home-page" ref={pageRef}>
      <header className="home-header">
        <div className="wordmark"><span>4</span>U<i></i></div>
        <div className="header-actions">
          <button aria-label="搜索" onClick={() => setSearching(true)}><SearchIcon size={22} /></button>
          <button aria-label="通知" className="has-badge" onClick={onGoMessages}><BellIcon size={22} /><i></i></button>
        </div>
      </header>

      <nav className="primary-tabs" aria-label="内容频道">
        {(['推荐', '活动', '话题'] as PrimaryTab[]).map((tab) => (
          <button key={tab} className={primary === tab ? 'is-active' : ''} onClick={() => onPrimary(tab)}>{tab}</button>
        ))}
      </nav>

      <nav className="secondary-tabs" aria-label={`${primary}分类`}>
        {subTabs[primary].map((sub) => (
          <button key={sub} className={secondary[primary] === sub ? 'is-active' : ''} onClick={() => onSecondary(primary, sub)}>{sub}</button>
        ))}
      </nav>

      {primary === '话题' ? (
        <section className="topic-grid screen-enter">
          {visibleTopics.map((topic, index) => (
            <article key={topic.id} className="topic-card" style={{ '--topic-color': topic.color } as React.CSSProperties}>
              <span>{topic.tag}</span>
              <h3>{topic.title}</h3>
              <div><i>{String(index + 1).padStart(2, '0')}</i><small>{topic.replies} 条讨论</small></div>
            </article>
          ))}
        </section>
      ) : (
        <>
          <div className="feed-intro screen-enter">
            <p>{primary === '推荐' ? '今天，和谁去哪里？' : secondary[primary] === '全部' ? '找到你想加入的真实活动' : `看看${secondary[primary]}的新活动`}</p>
            <span>{primary === '推荐' ? '基于兴趣、距离与关系机会' : '报名之前，先看活动，也看看同行的人'}</span>
          </div>
          <section className="masonry-grid screen-enter">
            {primary === '推荐' && secondary.推荐 === '为你' ? (
              <>
                <ActivityCard activity={activities[0]} saved={saved.has(activities[0].id)} onSave={onSave} onOpen={onOpenActivity} />
                <ActivityCard activity={activities[1]} saved={saved.has(activities[1].id)} onSave={onSave} onOpen={onOpenActivity} />
                <PersonCard person={people[1]} activity={activities[2]} onOpen={onOpenPerson} />
                <ActivityCard activity={activities[3]} saved={saved.has(activities[3].id)} onSave={onSave} onOpen={onOpenActivity} />
              </>
            ) : filtered.length ? filtered.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} saved={saved.has(activity.id)} onSave={onSave} onOpen={onOpenActivity} />
            )) : (
              <div className="empty-state"><strong>暂时没有合适的活动</strong><p>换个分类，或者发起一场你真正想去的活动。</p><button onClick={onCreate}>发起活动</button></div>
            )}
          </section>
        </>
      )}

      <button className="floating-create" onClick={onCreate}><PlusIcon size={20} /><span>发起</span></button>
      {searching && <SearchPanel onClose={() => setSearching(false)} onOpen={(activity) => { setSearching(false); onOpenActivity(activity); }} />}
    </div>
  );
}

export type { PrimaryTab };
