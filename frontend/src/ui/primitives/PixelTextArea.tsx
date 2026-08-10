import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';
import './primitives.css';

const LINE_HEIGHT_PX = 19; // 12px font * 1.6 line-height, rounded
const VERTICAL_PADDING_PX = 16;

export interface PixelTextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  maxRows?: number;
}

export const PixelTextArea = forwardRef<HTMLTextAreaElement, PixelTextAreaProps>(
  function PixelTextArea(
    { value, onChange, minRows = 3, maxRows = 18, className = '', ...rest },
    ref,
  ) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement, []);

    const resize = useCallback(() => {
      const node = inner.current;
      if (!node) return;
      node.style.height = 'auto';
      const max = maxRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX;
      node.style.height = `${Math.min(node.scrollHeight, max)}px`;
    }, [maxRows]);

    useEffect(resize, [value, resize]);

    return (
      <textarea
        ref={inner}
        className={`vx-textarea ${className}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minHeight: `${minRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX}px`,
          maxHeight: `${maxRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX}px`,
        }}
        {...rest}
      />
    );
  },
);
