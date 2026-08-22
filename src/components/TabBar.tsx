import { useEffect, useRef } from 'react';

export type TabOption<T extends string> = { value: T; label: string };

export function TabBar<T extends string>({ label, options, value, onChange, className = '' }: { label: string; options: readonly TabOption<T>[]; value: T; onChange: (value: T) => void; className?: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { refs.current = refs.current.slice(0, options.length); }, [options.length]);

  const onKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[nextIndex].value);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div className={'tab-bar ' + className} role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => { refs.current[index] = node; }}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
        >{option.label}</button>
      ))}
    </div>
  );
}
