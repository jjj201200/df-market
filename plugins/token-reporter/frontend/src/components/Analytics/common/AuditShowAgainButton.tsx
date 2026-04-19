import {IconEye, IconEyeCheck} from '@tabler/icons-react';
import {useAuditStore} from '../../../stores/auditStore';
import {useI18n} from '../../../i18n';
import Tooltip from '../../common/Tooltip';
import GradientIconButton, {type IconButtonTone} from './GradientIconButton';

/**
 * Header icon that toggles the audit status banner. Mono-color, no gradient.
 * Audit off  → IconEye,      muted (hover reveals accent tint)
 * Audit on   → IconEyeCheck, success (always green, signalling "active")
 */
export default function AuditShowAgainButton() {
  const {t} = useI18n();
  const status = useAuditStore((st) => st.status);
  const requestShow = useAuditStore((st) => st.requestShow);

  if (!status) return null;
  const enabled = status.auditEnabled;
  const Icon = enabled ? IconEyeCheck : IconEye;
  const tone: IconButtonTone = enabled ? 'success' : 'accent';

  return (
    <Tooltip content={t('audit.banner.showAgain')}>
      <GradientIconButton
        tone={tone}
        active={enabled}
        onClick={requestShow}
        ariaLabel={t('audit.banner.showAgain')}
      >
        <Icon size={18} stroke={2} />
      </GradientIconButton>
    </Tooltip>
  );
}
