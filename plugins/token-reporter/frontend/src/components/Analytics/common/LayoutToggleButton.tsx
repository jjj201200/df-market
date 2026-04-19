import {IconLayoutColumns, IconLayoutSidebarRightFilled} from '@tabler/icons-react';
import {useI18n} from '../../../i18n';
import Tooltip from '../../common/Tooltip';
import s from './LayoutToggleButton.module.scss';

interface Props {
  /** True when the drawer is currently rendered inline beside the page (split view). */
  splitView: boolean;
  onToggle: () => void;
}

/**
 * Toggle between drawer and split layouts. The icon shows the TARGET layout
 * (what happens on click), not the current one — matches common toggle UX.
 *
 *   drawer mode (current) → IconLayoutColumns            (click → go to split)
 *   split  mode (current) → IconLayoutSidebarRightFilled (click → back to drawer)
 */
export default function LayoutToggleButton({splitView, onToggle}: Props) {
  const {t} = useI18n();
  const label = splitView ? t('nav.exitSplitView') : t('nav.splitView');
  const Icon = splitView ? IconLayoutSidebarRightFilled : IconLayoutColumns;

  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={s.btn}
        onClick={onToggle}
        aria-label={label}
      >
        <Icon size={18} stroke={2} />
      </button>
    </Tooltip>
  );
}
