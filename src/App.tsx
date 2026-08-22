import { useEffect, useMemo, useState } from 'react';
import { activities, type Activity, type Person } from './data';
import { ActivityDetail } from './components/ActivityDetail';
import { BottomNav, type AppTab } from './components/BottomNav';
import { CreateActivity } from './components/CreateActivity';
import { PersonSheet } from './components/PersonSheet';
import { HomePage, type PrimaryTab } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';

type Overlay =
  | { type: 'activity'; activity: Activity }
  | { type: 'person'; person: Person; activity: Activity }
  | { type: 'create' }
  | null;

const readIds = (key: string) => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set<string>(); }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [primary, setPrimary] = useState<PrimaryTab>('推荐');
  const [secondary, setSecondary] = useState<Record<PrimaryTab, string>>({ 推荐: '为你', 活动: '全部', 话题: '热门' });
  const [saved, setSaved] = useState<Set<string>>(() => readIds('4u:saved'));
  const [joined, setJoined] = useState<Set<string>>(() => readIds('4u:joined'));
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem('4u:saved', JSON.stringify([...saved])); }, [saved]);
  useEffect(() => { localStorage.setItem('4u:joined', JSON.stringify([...joined])); }, [joined]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const toggleSave = (id: string) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); setToast('已取消收藏'); }
      else { next.add(id); setToast('已收藏，活动有变化会提醒你'); }
      return next;
    });
  };

  const join = (id: string) => {
    setJoined((current) => new Set([...current, id]));
    setToast('申请已提交，发起者确认后会通知你');
  };

  const page = useMemo(() => {
    if (activeTab === 'home') return <HomePage primary={primary} secondary={secondary} saved={saved} onPrimary={setPrimary} onSecondary={(tab, sub) => setSecondary((old) => ({ ...old, [tab]: sub }))} onSave={toggleSave} onOpenActivity={(activity) => setOverlay({ type: 'activity', activity })} onOpenPerson={(person, activity) => setOverlay({ type: 'person', person, activity })} onCreate={() => setOverlay({ type: 'create' })} onGoMessages={() => setActiveTab('messages')} />;
    if (activeTab === 'discover') return <DiscoverPage onOpen={(activity) => setOverlay({ type: 'activity', activity })} />;
    if (activeTab === 'profile') return <ProfilePage savedCount={saved.size} joinedCount={joined.size} onAction={setToast} />;
    return <MessagesPage onOpen={(activity) => setOverlay({ type: 'activity', activity })} />;
  }, [activeTab, joined.size, primary, saved, secondary]);

  const changeTab = (tab: AppTab) => {
    if (tab === activeTab) window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveTab(tab);
    setOverlay(null);
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient--one"></div><div className="ambient ambient--two"></div>
      <div className="mobile-app">
        {page}
        {!overlay && <BottomNav active={activeTab} onChange={changeTab} />}
        {overlay?.type === 'activity' && <ActivityDetail activity={overlay.activity} saved={saved.has(overlay.activity.id)} joined={joined.has(overlay.activity.id)} onBack={() => setOverlay(null)} onSave={toggleSave} onJoin={join} />}
        {overlay?.type === 'person' && <PersonSheet person={overlay.person} activity={overlay.activity} onClose={() => setOverlay(null)} onActivity={(activity) => setOverlay({ type: 'activity', activity })} />}
        {overlay?.type === 'create' && <CreateActivity onClose={() => setOverlay(null)} onCreated={() => setToast('活动草稿已保存')} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
