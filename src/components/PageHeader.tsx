import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1></div>{action}</header>;
}
