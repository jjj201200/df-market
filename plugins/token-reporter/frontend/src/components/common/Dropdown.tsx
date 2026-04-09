import {useState, useRef, useCallback} from 'react';
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
  offset,
  flip,
  shift,
  size as floatingSize,
} from '@floating-ui/react';
import {useVirtualizer} from '@tanstack/react-virtual';
import styles from './Dropdown.module.scss';
import clsx from 'clsx';

export interface DropdownOption {
  value: string;
  label: string;
  sub?: string;
  isNew?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  maxHeight?: number;
  matchWidth?: boolean;
  className?: string;
}

const ITEM_HEIGHT_SM = 28;
const ITEM_HEIGHT_MD = 32;
const VIRTUAL_THRESHOLD = 50;

export default function Dropdown({
  options,
  value,
  onChange,
  size = 'md',
  maxHeight = 280,
  matchWidth = false,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const itemHeight = size === 'sm' ? ITEM_HEIGHT_SM : ITEM_HEIGHT_MD;
  const useVirtual = options.length > VIRTUAL_THRESHOLD;

  const {refs, floatingStyles, context} = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip({padding: 8}),
      shift({padding: 8}),
      ...(matchWidth
        ? [
            floatingSize({
              apply({rects, elements}) {
                Object.assign(elements.floating.style, {
                  minWidth: `${rects.reference.width}px`,
                });
              },
            }),
          ]
        : []),
    ],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {escapeKey: true, outsidePress: true});
  const {getReferenceProps, getFloatingProps} = useInteractions([click, dismiss]);

  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
    enabled: useVirtual && open,
  });

  const selected = options.find((o) => o.value === value);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div className={clsx(styles.dropdown, className)}>
      <button
        ref={refs.setReference}
        className={clsx(styles.trigger, styles[size], open && styles.open)}
        {...getReferenceProps()}
      >
        <span className={styles.triggerLabel}>
          {selected?.label ?? '\u00a0'}
          {selected?.sub && <span className={styles.triggerSub}>{selected.sub}</span>}
        </span>
        <span className={clsx(styles.chevron, open && styles.chevronOpen)}>&#x25BE;</span>
      </button>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={styles.popover}
            {...getFloatingProps()}
          >
            <div ref={scrollRef} className={styles.listWrap} style={{maxHeight}}>
              {useVirtual ? (
                <div style={{height: virtualizer.getTotalSize(), position: 'relative'}}>
                  {virtualizer.getVirtualItems().map((vItem) => {
                    const opt = options[vItem.index]!;
                    return (
                      <button
                        key={opt.value}
                        className={clsx(styles.option, styles[size], opt.value === value && styles.active)}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: vItem.size,
                          transform: `translateY(${vItem.start}px)`,
                        }}
                        onClick={() => handleSelect(opt.value)}
                      >
                        <span className={styles.optLabel}>{opt.label}</span>
                        {opt.sub && <span className={styles.optSub}>{opt.sub}</span>}
                        {opt.isNew && <span className={styles.optNew}>NEW</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    className={clsx(styles.option, styles[size], opt.value === value && styles.active)}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className={styles.optLabel}>{opt.label}</span>
                    {opt.sub && <span className={styles.optSub}>{opt.sub}</span>}
                    {opt.isNew && <span className={styles.optNew}>NEW</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
