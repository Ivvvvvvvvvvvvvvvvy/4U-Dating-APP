import { CompassIcon, HomeIcon, MessageIcon, UserIcon } from './Icons';

export type AppTab = 'home' | 'discover' | 'profile' | 'messages';

const items = [
  { id: 'home' as const, label: '首页', Icon: HomeIcon },
  { id: 'discover' as const, label: '寻觅', Icon: CompassIcon },
  { id: 'profile' as const, label: '我的', Icon: UserIcon },
  { id: 'messages' as const, label: '消息', Icon: MessageIcon },
];

export function BottomNav({ active, onChange }: { active: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map(({ id, label, Icon }) => (
        <button key={id} className={active === id ? 'is-active' : ''} onClick={() => onChange(id)}>
          <span className="nav-icon"><Icon size={23} /></span>
          <span>{label}</span>
          {id === 'messages' && <i className="notification-dot"></i>}
        </button>
      ))}
    </nav>
  );
}
