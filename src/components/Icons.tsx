import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export function HomeIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-6h6v6"/></svg>; }
export function CompassIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9Z"/></svg>; }
export function MessageIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>; }
export function UserIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>; }
export function SearchIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>; }
export function HeartIcon({ size, filled, ...props }: IconProps & { filled?: boolean }) { return <svg {...base(size)} fill={filled ? 'currentColor' : 'none'} {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>; }
export function ArrowLeftIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m15 18-6-6 6-6"/></svg>; }
export function ChevronRightIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m9 18 6-6-6-6"/></svg>; }
export function MapPinIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>; }
export function CalendarIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>; }
export function PlusIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function SparkIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8Z"/><path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7Z"/></svg>; }
export function BellIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>; }
export function CheckIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m5 12 4 4L19 6"/></svg>; }
export function CloseIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>; }
export function SendIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>; }
export function ClockIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>; }
export function SettingsIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6v.2H10V21a1.8 1.8 0 0 0-1.1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1L4 17.1l.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 13.9h-.2V10H3a1.8 1.8 0 0 0 1.5-1.1 1.8 1.8 0 0 0-.4-2L4 6.8 6.8 4l.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3V2.8h4V3a1.8 1.8 0 0 0 1.1 1.5 1.8 1.8 0 0 0 2-.4l.1-.1L20 6.8l-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 10h.2v3.9H21a1.8 1.8 0 0 0-1.6 1.1Z"/></svg>; }
export function ShieldIcon({ size, ...props }: IconProps) { return <svg {...base(size)} {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>; }
