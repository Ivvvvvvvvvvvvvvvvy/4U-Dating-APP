import type { ReactNode } from 'react';
import { ArrowUp, RefreshCcw, WifiOff } from 'lucide-react';

export function OfflineBanner() {
  return <div className="offline-banner" role="status"><WifiOff size={15}/><span>当前离线，正在展示最近缓存；心动与报名需联网确认</span></div>;
}

export function EmptyState({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="state-card state-card--empty"><span className="state-orbit" aria-hidden="true"/><h2>{title}</h2><p>{description}</p>{actions && <div className="state-actions">{actions}</div>}</div>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="state-card" role="alert"><RefreshCcw/><h2>这一段没有加载成功</h2><p>已加载内容会保留。你可以单独重试这一段。</p><button className="secondary-button" onClick={onRetry}>重新加载</button></div>;
}

export function EndOfFeed() {
  return <div className="end-feed"><span>暂时看到这里</span><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={16}/>回到顶部</button></div>;
}

export function FeedSkeleton({ kind }: { kind: 'activity' | 'person' | 'topic' }) {
  return <article className={'feed-card skeleton-card skeleton-card--' + kind} aria-label="内容加载中" aria-busy="true"><div/><span/><span/><span/></article>;
}
