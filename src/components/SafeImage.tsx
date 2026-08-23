import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  ratio?: string;
  fallbackLabel?: string;
};

export function SafeImage({ ratio, fallbackLabel = '图片暂不可用', className = '', alt = '', onLoad, onError, ...props }: Props) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const source = props.src;

  useEffect(() => {
    setState('loading');
  }, [source]);

  return (
    <span className={'safe-image safe-image--' + state + ' ' + className} style={{ aspectRatio: ratio }} data-image-state={state}>
      {state !== 'failed' && (
        <img
          {...props}
          alt={alt}
          referrerPolicy={props.referrerPolicy ?? 'no-referrer'}
          onLoad={(event) => { setState('loaded'); onLoad?.(event); }}
          onError={(event) => { setState('failed'); onError?.(event); }}
        />
      )}
      {state === 'loading' && <span className="safe-image__shimmer" aria-hidden="true" />}
      {state === 'failed' && <span className="safe-image__fallback"><ImageOff size={22} /><small>{fallbackLabel}</small></span>}
    </span>
  );
}
