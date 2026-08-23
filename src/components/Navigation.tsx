import { Bell, Compass, Home, MessageCircle, Plus, Search, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Person } from '../domain';
import { SafeImage } from './SafeImage';

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

export function SideNav({ active, inactive = false, viewer, onNavigate, onCreate }: { active: NavTab; inactive?: boolean; viewer: Pick<Person, 'displayName' | 'photos'>; onNavigate: (path: string) => void; onCreate: () => void }) {
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
      <div className="side-profile"><SafeImage src={viewer.photos[0].url} alt={viewer.photos[0].alt} ratio="1" fallbackLabel="头像"/><div><b>{viewer.displayName}</b><small>体验账号</small></div></div>
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

export function MobileBrandBar({ tabs, onSearch, onMessages }: { tabs?: ReactNode; onSearch: () => void; onMessages: () => void }) {
  return <header className="mobile-brand-bar"><Brand compact />{tabs}<div className="mobile-brand-actions"><button className="icon-button" aria-label="搜索" onClick={onSearch}><Search size={19}/></button><button className="icon-button has-unread" aria-label="通知，3 条未读" onClick={onMessages}><Bell size={19}/></button></div></header>;
}
