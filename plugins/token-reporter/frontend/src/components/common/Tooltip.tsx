import {useState, cloneElement, isValidElement} from 'react';
import type {ReactElement, ReactNode} from 'react';
import {
  useFloating,
  useHover,
  useFocus,
  useDismiss,
  useInteractions,
  FloatingPortal,
  offset,
  flip,
  shift,
  arrow,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import type {Placement} from '@floating-ui/react';
import {useRef} from 'react';
import s from './Tooltip.module.scss';

interface TooltipProps {
  content: ReactNode;
  placement?: Placement;
  delay?: number;
  children: ReactElement;
}

export default function Tooltip({content, placement = 'top', delay = 300, children}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const arrowRef = useRef<HTMLDivElement>(null);

  const {refs, floatingStyles, context, middlewareData} = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({padding: 8}), arrow({element: arrowRef})],
  });

  const hover = useHover(context, {delay: {open: delay, close: 0}});
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, {role: 'tooltip'});
  const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, dismiss, role]);

  const {isMounted, styles: transitionStyles} = useTransitionStyles(context, {
    duration: 150,
    initial: {opacity: 0},
  });

  // Compute arrow position
  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;
  const side = placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';
  const arrowSide = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'}[side] as string;

  if (!isValidElement(children)) return children;

  return (
    <>
      {cloneElement(children, {
        ref: refs.setReference,
        ...getReferenceProps(),
      } as Record<string, unknown>)}
      {isMounted && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className={s.tooltip}
            style={{...floatingStyles, ...transitionStyles}}
            {...getFloatingProps()}
          >
            {content}
            <div
              ref={arrowRef}
              className={s.arrow}
              style={{
                left: arrowX != null ? arrowX : undefined,
                top: arrowY != null ? arrowY : undefined,
                [arrowSide]: -3,
              }}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
