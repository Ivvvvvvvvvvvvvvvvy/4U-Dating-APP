import { Children, Fragment, isValidElement, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Position = { left: number; top: number; width: number };

function columnCount(width: number) {
  if (width >= 1080) return 5;
  if (width >= 880) return 4;
  if (width >= 640) return 3;
  return 2;
}

export function MasonryFeed({ children, className = '', label = '内容流' }: { children: ReactNode; className?: string; label?: string }) {
  const items = Children.toArray(children).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return Children.toArray(child.props.children);
    }
    return [child];
  });
  const rootRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const frame = useRef<number | null>(null);
  const [widths, setWidths] = useState<{ count: number; width: number; gap: number }>({ count: 2, width: 0, gap: 9 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [height, setHeight] = useState(0);

  const measureColumns = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const width = root.clientWidth;
    const count = columnCount(width);
    const gap = window.innerWidth >= 768 ? 14 : 9;
    const cardWidth = (width - gap * (count - 1)) / count;
    setWidths((current) => current.count === count && Math.abs(current.width - cardWidth) < .5 && current.gap === gap ? current : { count, width: cardWidth, gap });
  }, []);

  const placeItems = useCallback(() => {
    if (!widths.width) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const heights = Array.from({ length: widths.count }, () => 0);
      const next = itemRefs.current.slice(0, items.length).map((element) => {
        const minimum = Math.min(...heights);
        const column = heights.indexOf(minimum);
        const measuredHeight = element?.getBoundingClientRect().height ?? 0;
        const position = { left: column * (widths.width + widths.gap), top: heights[column], width: widths.width };
        heights[column] += measuredHeight + widths.gap;
        return position;
      });
      setPositions(next);
      setHeight(Math.max(0, ...heights) - widths.gap);
    });
  }, [items.length, widths]);

  useLayoutEffect(() => {
    measureColumns();
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measureColumns);
    observer.observe(root);
    return () => observer.disconnect();
  }, [measureColumns]);

  useLayoutEffect(() => {
    const observers = itemRefs.current.slice(0, items.length).map((element) => {
      if (!element) return null;
      const observer = new ResizeObserver(placeItems);
      observer.observe(element);
      return observer;
    });
    placeItems();
    return () => { observers.forEach((observer) => observer?.disconnect()); if (frame.current) cancelAnimationFrame(frame.current); };
  }, [items.length, placeItems, widths.width]);

  return (
    <section ref={rootRef} className={'masonry-feed ' + className} aria-label={label} data-columns={widths.count} style={{ height: height || undefined }}>
      {items.map((child, index) => <div key={(child as { key?: string }).key ?? index} ref={(node) => { itemRefs.current[index] = node; }} className="masonry-item" style={{ width: widths.width || undefined, transform: 'translate3d(' + (positions[index]?.left ?? 0) + 'px,' + (positions[index]?.top ?? 0) + 'px,0)', visibility: widths.width ? 'visible' : 'hidden' }}>{child}</div>)}
    </section>
  );
}
