import { Bell, Compass, Home, MessageCircle, Plus, Search, UserRound } from 'lucide-react';

export type NavTab = 'home' | 'discover' | 'messages' | 'me';

const navItems = [
  { id: 'home' as const, label: '首页', path: '/home?primary=recommend&secondary=for-you', Icon: Home },
  { id: 'discover' as const, label: '寻觅', path: '/discover?segment=for-you', Icon: Compass },
  { id: 'messages' as const, label: '消息', path: '/messages?category=matches', Icon: MessageCircle },
  { id: 'me' as const, label: '我的', path: '/me/profile', Icon: UserRound },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={'brand' + (compact ? ' brand--compact' : '')} aria-label="for U"><strong>for</strong><span>U</span><i /></div>;
}

export function SideNav({ active, inactive = false, onNavigate, onCreate }: { active: NavTab; inactive?: boolean; onNavigate: (path: string) => void; onCreate: () => void }) {
  return (
    <aside className="side-nav" aria-label="主导航" inert={inactive ? true : undefined} aria-hidden={inactive ? true : undefined}>
      <Brand />
      <nav>
        {navItems.map(({ id, label, path, Icon }) => (
          <button key={id} type="button" className={active === id ? 'is-active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(path)}>
            <span><Icon size={21} /></span><b>{label}</b>{id === 'messages' && <i aria-label="3 条未读">3</i>}
          </button>
        ))}
      </nav>
      <button className="side-create" type="button" onClick={onCreate}><Plus size={20} /><span>发起活动</span></button>
      <div className="side-profile"><span>LC</span><div><b>林川</b><small>真人已认证</small></div></div>
    </aside>
  );
}

export function BottomNav({ active, onNavigate }: { active: NavTab; onNavigate: (path: string) => void }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {navItems.map(({ id, label, path, Icon }) => (
        <button key={id} type="button" className={active === id ? 'is-active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(path)}>
          <span><Icon size={21} /></span><b>{label}</b>{id === 'messages' && <i aria-label="3 条未读" />}
        </button>
      ))}
    </nav>
  );
}

export function MobileBrandBar({ onSearch, onMessages }: { onSearch: () => void; onMessages: () => void }) {
  return <header className="mobile-brand-bar"><Brand compact /><div><button className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={21}/></button><button className="icon-button has-unread" aria-label="通知，3 条未读" onClick={onMessages}><Bell size={21}/></button></div></header>;
}
