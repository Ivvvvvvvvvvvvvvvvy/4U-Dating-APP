import type { ReactNode } from 'react';
import type { Person } from '../domain';
import { BottomNav, type NavTab, SideNav } from './Navigation';

export function AppShell({ active, children, detail, immersive = false, viewer, onNavigate, onCreate }: { active: NavTab; children: ReactNode; detail?: ReactNode; immersive?: boolean; viewer: Pick<Person, 'displayName' | 'photos'>; onNavigate: (path: string) => void; onCreate: () => void }) {
  return (
    <div className={'app-shell ' + (detail ? 'has-detail' : '')}>
      <SideNav active={active} inactive={Boolean(detail)} viewer={viewer} onNavigate={onNavigate} onCreate={onCreate}/>
      <main className="app-main" id="main-content" inert={detail ? true : undefined} aria-hidden={detail ? true : undefined}>{children}</main>
      {detail && <aside className="detail-rail">{detail}</aside>}
      {!detail && !immersive && <BottomNav active={active} onNavigate={onNavigate}/>}
    </div>
  );
}
