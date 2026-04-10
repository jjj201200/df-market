import {useLimitsStore} from '../../stores/limitsStore';
import {useSessionStore} from '../../stores/sessionStore';
import {fmt, fmtResetTimeAbsolute, fmtResetTimeShort} from '../../utils/format';
import {useI18n} from '../../i18n';
import styles from './LimitsDisplay.module.scss';

function barColor(pct: number): string {
  if (pct > 90) return 'var(--danger)';
  if (pct > 70) return 'var(--warning)';
  return 'var(--success)';
}

interface LimitItemProps {
  label: string;
  pct: number;
  detail?: string;
  shortDetail?: string;
}

function LimitItem({label, pct, detail, shortDetail}: LimitItemProps) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className={styles.limitItemCompact}>
      <span className={styles.limitLabel}>{label}</span>
      <div className={styles.limitBar}>
        <div className={styles.limitFill} style={{width: `${width}%`, background: barColor(width)}} />
      </div>
      <span className={styles.limitPct}>{Math.round(pct)}%</span>
      {detail && <span className={styles.limitDetail}>{detail}</span>}
      {shortDetail && <span className={styles.limitDetailShort}>{shortDetail}</span>}
    </div>
  );
}

export default function LimitsDisplay() {
  const {t} = useI18n();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const allLimits = useLimitsStore((s) => s.limits);

  if (!activeSessionId) return null;
  const limits = allLimits[activeSessionId];
  if (!limits) return null;

  // Handle both camelCase (from GET /api/limits) and snake_case (from SSE limits_update)
  const rawLimits = limits as Record<string, unknown>;
  const ctx = limits.contextWindow ?? (rawLimits['context_window'] as typeof limits.contextWindow);
  const rate = limits.rateLimits ?? (rawLimits['rate_limits'] as typeof limits.rateLimits);
  const fiveHour = rate?.five_hour;
  const sevenDay = rate?.seven_day;

  const ctxPct = ctx?.used_percentage || 0;
  const fivePct = fiveHour?.used_percentage || 0;
  const sevenPct = sevenDay?.used_percentage || 0;

  // Calculate context detail
  const currentUsage = ctx?.current_usage;
  let ctxDetail = '';
  if (currentUsage) {
    const ctxUsed =
      (currentUsage.input_tokens || 0) +
      (currentUsage.output_tokens || 0) +
      (currentUsage.cache_read_input_tokens || 0) +
      (currentUsage.cache_creation_input_tokens || 0);

    if (ctx?.context_window_size) {
      ctxDetail = `${fmt(ctxUsed)}/${fmt(ctx.context_window_size)}`;
    } else if (ctxPct > 0) {
      const estimatedSize = Math.round(ctxUsed / (ctxPct / 100));
      ctxDetail = `${fmt(ctxUsed)}/${fmt(estimatedSize)}`;
    }
  }

  const hasRateLimits = !!rate;
  const fiveHourResetsAt = fiveHour?.resets_at;
  const sevenDayResetsAt = sevenDay?.resets_at;

  // Only render if there is at least some data
  // const hasCtx = ctxPct > 0;
  const hasFive = hasRateLimits && fiveHourResetsAt;
  const hasSeven = hasRateLimits && sevenDayResetsAt;
  // if (!hasCtx && !hasFive && !hasSeven) return null;

  return (
    <div className={styles.limitGroup}>
      <span className={styles.limitBarTip}>{t('limits.title')}</span>
      <div className={styles.limitsRowCompact}>
        <LimitItem
          label={t('limits.session')}
          pct={ctxPct}
          detail={ctxDetail || undefined}
          shortDetail={ctxDetail || undefined}
        />
        {hasFive && (
          <LimitItem
            label={t('limits.fiveHour')}
            pct={fivePct}
            detail={t('limits.reset', {time: fmtResetTimeAbsolute(fiveHourResetsAt!)})}
            shortDetail={t('limits.reset', {time: fmtResetTimeShort(fiveHourResetsAt!)})}
          />
        )}
        {hasSeven && (
          <LimitItem
            label={t('limits.sevenDay')}
            pct={sevenPct}
            detail={t('limits.reset', {time: fmtResetTimeAbsolute(sevenDayResetsAt!)})}
            shortDetail={t('limits.reset', {time: fmtResetTimeShort(sevenDayResetsAt!)})}
          />
        )}
      </div>
    </div>
  );
}
