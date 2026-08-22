import type { ReactNode } from 'react';
import { BottomNav, type NavTab, SideNav } from './Navigation';

export function AppShell({ active, children, detail, immersive = false, onNavigate, onCreate }: { active: NavTab; children: ReactNode; detail?: ReactNode; immersive?: boolean; onNavigate: (path: string) => void; onCreate: () => void }) {
  return (
    <div className={'app-shell ' + (detail ? 'has-detail' : '')}>
      <SideNav active={active} inactive={Boolean(detail)} onNavigate={onNavigate} onCreate={onCreate}/>
      <main className="app-main" id="main-content" inert={detail ? true : undefined} aria-hidden={detail ? true : undefined}>{children}</main>
      {detail && <aside className="detail-rail">{detail}</aside>}
      {!detail && !immersive && <BottomNav active={active} onNavigate={onNavigate}/>}
    </div>
  );
}
