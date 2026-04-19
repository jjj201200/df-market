import {useEffect} from 'react';
import {useAuditStore} from '../../../stores/auditStore';
import {useI18n} from '../../../i18n';
import s from './AuditBanner.module.scss';

/**
 * Top-of-page banner showing audit opt-in nudge (first visit) or a hookStale
 * warning (audit was turned on but the fetch hook hasn't heartbeat recently).
 * Hidden once the user dismisses the opt-in, and hidden outright when audit
 * is already enabled and the hook is alive.
 */
export default function AuditBanner() {
  const {t} = useI18n();
  const status = useAuditStore((st) => st.status);
  const dismissed = useAuditStore((st) => st.dismissed);
  const forceShow = useAuditStore((st) => st.forceShow);
  const fetchStatus = useAuditStore((st) => st.fetchStatus);
  const dismiss = useAuditStore((st) => st.dismiss);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (!status) return null;

  // hookStale takes precedence — user enabled audit but hook hasn't captured in >5min.
  if (status.auditEnabled && status.hookStale) {
    return (
      <div className={`${s.banner} ${s.stale}`} role="alert">
        <div className={s.text}>
          <strong>{t('audit.banner.hookStaleTitle')}</strong>{' '}
          <span>{t('audit.banner.hookStaleCta')}</span>
        </div>
      </div>
    );
  }

  // Audit enabled and hook alive — show a positive confirmation, but only on
  // explicit recall via the header icon (forceShow). Otherwise stay hidden so
  // the page chrome isn't always noisy.
  if (status.auditEnabled && forceShow) {
    return (
      <div className={`${s.banner} ${s.enabled}`} role="status">
        <div className={s.text}>
          <strong>{t('audit.banner.enabledTitle')}</strong>{' '}
          <span>{t('audit.banner.enabledCta')}</span>
        </div>
        <button type="button" className={s.dismiss} onClick={() => dismiss()}>
          {t('audit.banner.dismiss')}
        </button>
      </div>
    );
  }

  // Opt-in nudge — shown when audit is off, and either:
  //   - user hasn't been prompted yet this session, OR
  //   - user explicitly recalled the banner via the header icon (forceShow)
  const shouldNudge = !status.auditEnabled && !dismissed && (forceShow || !status.auditPromptedAt);
  if (shouldNudge) {
    return (
      <div className={s.banner} role="status">
        <div className={s.text}>
          <strong>{t('audit.banner.title')}</strong>{' '}
          <span>{t('audit.banner.cta')}</span>
        </div>
        <button type="button" className={s.dismiss} onClick={() => dismiss()}>
          {t('audit.banner.dismiss')}
        </button>
      </div>
    );
  }

  return null;
}
