import { useState } from 'react';
import type { Activity } from '../data';
import { activities } from '../data';
import { CalendarIcon, MapPinIcon, SearchIcon, SparkIcon } from '../components/Icons';

export function DiscoverPage({ onOpen }: { onOpen: (activity: Activity) => void }) {
  const [mode, setMode] = useState<'同行者' | '活动'>('同行者');
  const [filters, setFilters] = useState(['本周末', '5km 内', '全部人数']);
  const toggleMode = (next: '同行者' | '活动') => { setMode(next); setFilters((old) => [old[0], old[1], next === '同行者' ? '全部人数' : '正在招募']); };
  const options = [['本周末', '下周', '时间不限'], ['5km 内', '10km 内', '全城'], ['全部人数', '双人同行', '多人小组']];
  const cycleFilter = (index: number) => setFilters((current) => current.map((value, i) => i === index ? options[index][(options[index].indexOf(value) + 1) % options[index].length] : value));

  return (
    <div className="page inner-page screen-enter">
      <div className="simple-header"><div><small>主动发现</small><h1>寻觅</h1></div><button><SearchIcon size={22} /></button></div>
      <div className="segmented"><button className={mode === '同行者' ? 'is-active' : ''} onClick={() => toggleMode('同行者')}>找同行者</button><button className={mode === '活动' ? 'is-active' : ''} onClick={() => toggleMode('活动')}>找活动</button></div>
      <div className="filter-chips">{filters.map((filter, index) => <button key={`${index}-${filter}`} onClick={() => cycleFilter(index)}>{filter}</button>)}</div>
      <section className="discover-hero">
        <span><SparkIcon size={16} />今晚为你找到 6 个机会</span>
        <h2>{mode === '同行者' ? '先选想做的事，再看谁也刚好想去' : '真实发起、时间合适、现在可申请'}</h2>
        <p>不做无场景滑卡，每一个人都与一场具体活动相连。</p>
      </section>
      <section className="discover-list">
        {activities.slice(0, 3).map((activity) => (
          <button key={activity.id} className="discover-row" onClick={() => onOpen(activity)}>
            <img src={activity.image} alt="" />
            <div><span>{activity.kind === 'duo' ? '双人同行' : '多人小组'} · {activity.matchLabel}</span><strong>{activity.title}</strong><small><CalendarIcon size={14} />{activity.date} {activity.time}<MapPinIcon size={14} />{activity.distance}</small></div>
          </button>
        ))}
      </section>
    </div>
  );
}
