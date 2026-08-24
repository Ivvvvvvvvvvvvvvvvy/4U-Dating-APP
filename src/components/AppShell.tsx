import type { ReactNode } from 'react';
import type { Person } from '../domain';
import { BottomNav, type NavTab, SideNav } from './Navigation';

export function AppShell({ active, children, detail, immersive = false, chromeless = false, viewer, onNavigate, onCreate, onSwitchAccount }: { active: NavTab; children: ReactNode; detail?: ReactNode; immersive?: boolean; chromeless?: boolean; viewer: Pick<Person, 'displayName' | 'photos'>; onNavigate: (path: string) => void; onCreate: () => void; onSwitchAccount: () => void }) {
  return (
    <div className={'app-shell ' + (detail ? 'has-detail ' : '') + (chromeless ? 'is-chromeless' : '')}>
      {!chromeless && <SideNav active={active} inactive={Boolean(detail)} viewer={viewer} onNavigate={onNavigate} onCreate={onCreate} onSwitchAccount={onSwitchAccount}/>}
      <main className="app-main" id="main-content" inert={detail ? true : undefined} aria-hidden={detail ? true : undefined}>{children}</main>
      {detail && <aside className="detail-rail">{detail}</aside>}
      {!chromeless && !detail && !immersive && <BottomNav active={active} onNavigate={onNavigate}/>} 
    </div>
  );
}
