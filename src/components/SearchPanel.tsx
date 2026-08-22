import { useMemo, useState } from 'react';
import { activities, topicCards, type Activity } from '../data';
import { ArrowLeftIcon, SearchIcon } from './Icons';

export function SearchPanel({ onClose, onOpen }: { onClose: () => void; onOpen: (activity: Activity) => void }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const rawKeyword = query.trim().toLowerCase();
    const aliases: Record<string, string> = { 看展: '展览', 逛展: '展览', 走走: '散步', 徒步: '散步', 攀岩: '抱石' };
    const keyword = aliases[rawKeyword] || rawKeyword;
    if (!keyword) return activities.slice(0, 3);
    return activities.filter((item) => [item.title, item.category, item.district, ...item.atmosphere].join(' ').toLowerCase().includes(keyword));
  }, [query]);
  const topics = query.trim() ? topicCards.filter((item) => item.title.includes(query.trim()) || item.tag.includes(query.trim())) : [];

  return (
    <div className="search-panel screen-enter">
      <header className="search-header">
        <button onClick={onClose} aria-label="关闭搜索"><ArrowLeftIcon /></button>
        <label><SearchIcon size={18}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜活动、地点或话题" /></label>
      </header>
      <main className="search-results">
        <div className="search-suggestions"><span>试试</span>{['看展','散步','双人同行'].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div>
        <h2>{query ? `“${query}”的结果` : '最近受欢迎'}</h2>
        {matches.length ? matches.map((activity) => (
          <button className="search-result" key={activity.id} onClick={() => onOpen(activity)}>
            <img src={activity.image} alt=""/><div><span>{activity.kind === 'duo' ? '双人同行' : '多人小组'} · {activity.category}</span><strong>{activity.title}</strong><small>{activity.date} · {activity.district}</small></div>
          </button>
        )) : <div className="search-empty"><strong>没有找到活动</strong><p>换个关键词，或从首页发起一场。</p></div>}
        {topics.length > 0 && <><h2>相关话题</h2>{topics.map((topic) => <div className="topic-result" key={topic.id}><span>{topic.tag}</span><strong>{topic.title}</strong></div>)}</>}
      </main>
    </div>
  );
}
