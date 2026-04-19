import type {ReactNode} from 'react';
import s from './GradientIconButton.module.scss';

export type IconButtonTone = 'accent' | 'danger' | 'success' | 'muted';

interface Props {
  tone?: IconButtonTone;
  /** When true, use the tone's active color as default (not hover). */
  active?: boolean;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * Header icon button used in AnalyticsDrawer: 26×26, transparent by default,
 * hover reveals a neutral (dark-mode safe) surface. Stroke stays mono-color;
 * the tone decides which CSS variable drives the color on hover (or always,
 * when `active`).
 */
export default function GradientIconButton({
  tone = 'muted',
  active = false,
  onClick,
  title,
  ariaLabel,
  children,
}: Props) {
  return (
    <button
      type="button"
      className={[
        s.btn,
        s[`tone_${tone}`] ?? '',
        active ? s.active : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
    >
      {children}
    </button>
  );
}
