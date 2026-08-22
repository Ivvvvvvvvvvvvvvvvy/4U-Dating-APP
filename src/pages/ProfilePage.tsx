import { activities } from '../data';
import { CalendarIcon, ChevronRightIcon, HeartIcon, SettingsIcon, ShieldIcon } from '../components/Icons';

export function ProfilePage({ savedCount, joinedCount, onAction }: { savedCount: number; joinedCount: number; onAction: (message: string) => void }) {
  return (
    <div className="page profile-page screen-enter">
      <div className="profile-cover">
        <button className="profile-settings" onClick={() => onAction('设置功能将在下一版本开放')}><SettingsIcon size={22} /></button>
        <div className="profile-identity"><img src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=360&q=85" alt="我的头像" /><div><span>真人已认证</span><h1>林川</h1><p>29 · 上海 · 对认真关系保持开放</p></div></div>
      </div>
      <section className="profile-stats"><div><strong>{joinedCount + 6}</strong><span>参加过</span></div><div><strong>3</strong><span>发起过</span></div><div><strong>{savedCount}</strong><span>已收藏</span></div></section>
      <section className="profile-section"><div className="section-heading"><h2>我的兴趣坐标</h2><button onClick={() => onAction('兴趣编辑功能将在下一版本开放')}>编辑</button></div><div className="interest-cloud"><span>当代艺术</span><span>城市漫步</span><span>独立电影</span><span>轻运动</span><span>黑胶</span></div></section>
      <section className="profile-section"><div className="section-heading"><h2>即将参加</h2><span>2 场</span></div><button className="mini-event" onClick={() => onAction('活动详情已收纳在首页演示中')}><img src={activities[1].image} alt=""/><div><strong>{activities[1].title}</strong><p><CalendarIcon size={14}/>{activities[1].date} {activities[1].time}</p></div><ChevronRightIcon size={18}/></button></section>
      <section className="settings-list"><button onClick={() => onAction(`已收藏 ${savedCount} 场活动`)}><HeartIcon size={20}/><span>我的收藏</span><b>{savedCount}</b><ChevronRightIcon size={18}/></button><button onClick={() => onAction('隐私与安全规则已启用')}><ShieldIcon size={20}/><span>隐私与安全</span><ChevronRightIcon size={18}/></button></section>
    </div>
  );
}
