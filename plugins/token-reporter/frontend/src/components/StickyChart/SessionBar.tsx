import {useMemo} from 'react';
import clsx from 'clsx';
import {useSessionStore} from '../../stores/sessionStore';
import {useChartStore} from '../../stores/chartStore';
import {fmt, fmtTokens} from '../../utils/format';
import {brushToFirstIdx, brushToLastIdx} from '../../utils/brushCoords';
import {useI18n} from '../../i18n';
import Tooltip from '../common/Tooltip';
import styles from './SessionBar.module.scss';

export default function SessionBar() {
  const {t} = useI18n();
  const turns = useSessionStore((s) => s.turns);
  const sessionLoading = useSessionStore((s) => s.sessionLoading);
  const sessionsLoading = useSessionStore((s) => s.sessionsLoading);
  const isLoading = sessionsLoading || sessionLoading;
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);
  const hooks = useSessionStore((s) => s.hooks);
  const subagents = useSessionStore((s) => s.subagents);
  const stopReasons = useSessionStore((s) => s.stopReasons);

  const totals = useMemo(() => {
    const N = turns.length;
    if (N === 0) return {tIn: 0, tOut: 0, tCR: 0, tCC: 0, count: 0};
    const lo = brushToFirstIdx(brushL, N);
    const hi = brushToLastIdx(brushR, N);
    const vis = turns.slice(lo, hi + 1);
    let tIn = 0;
    let tOut = 0;
    let tCR = 0;
    let tCC = 0;
    for (const d of vis) {
      tIn += d.input;
      tOut += d.output;
      tCR += d.cacheR;
      tCC += d.cacheC;
    }
    return {tIn, tOut, tCR, tCC, count: vis.length};
  }, [turns, brushL, brushR]);

  const sessionTotals = useMemo(() => {
    let tIn = 0;
    let tOut = 0;
    let tCR = 0;
    let tCC = 0;
    let toolCount = 0;
    let errCount = 0;
    for (const d of turns) {
      tIn += d.input;
      tOut += d.output;
      tCR += d.cacheR;
      tCC += d.cacheC;
      toolCount += d.tools.length;
      for (const t of d.tools) {
        if (t.isErr) errCount += 1;
      }
    }
    const assistantCount = turns.length;
    const hookCount = hooks.length;
    const subagentCount = Object.keys(subagents).length;
    const stopReasonEntries = Object.entries(stopReasons);
    return {tIn, tOut, tCR, tCC, assistantCount, toolCount, hookCount, subagentCount, errCount, stopReasonEntries};
  }, [turns, hooks, subagents, stopReasons]);

  const tooltipContent = useMemo(() => {
    const st = sessionTotals;
    return (
      <div className={styles.totalsTooltip}>
        <div className={styles.totalsTooltipTitle}>{t('session.totalsTitle')}</div>
        <table className={styles.totalsTooltipTable}>
          <tbody>
            <tr>
              <td>{t('session.assistantMessages')}</td>
              <td>{st.assistantCount}</td>
            </tr>
            <tr>
              <td>{t('session.totalTokens')}</td>
              <td>{fmtTokens(st.tIn + st.tOut + st.tCR + st.tCC)}</td>
            </tr>
            <tr>
              <td>{t('common.input')}</td>
              <td>{fmtTokens(st.tIn)}</td>
            </tr>
            <tr>
              <td>{t('common.output')}</td>
              <td>{fmtTokens(st.tOut)}</td>
            </tr>
            <tr>
              <td>{t('common.cacheRead')}</td>
              <td>{fmtTokens(st.tCR)}</td>
            </tr>
            <tr>
              <td>{t('common.cacheCreate')}</td>
              <td>{fmtTokens(st.tCC)}</td>
            </tr>
            <tr>
              <td>{t('session.toolUses')}</td>
              <td>{st.toolCount}</td>
            </tr>
            <tr>
              <td>{t('session.hookCalls')}</td>
              <td>{st.hookCount}</td>
            </tr>
            <tr>
              <td>{t('session.subagents')}</td>
              <td>{st.subagentCount}</td>
            </tr>
            <tr>
              <td>{t('session.errors')}</td>
              <td>{st.errCount}</td>
            </tr>
            {st.stopReasonEntries.length > 0 && (
              <tr>
                <td>{t('session.stopReasons')}</td>
                <td>{st.stopReasonEntries.map(([k, v]) => `${k}: ${v}`).join(', ')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }, [sessionTotals, t]);

  return (
    <div className={styles.sessionBar}>
      {!isLoading && (
        <Tooltip content={tooltipContent} placement="bottom" delay={200}>
          <div className={styles.sessionTotalsWrap}>
            <span className={styles.sessionTotalsLabel}>{t('session.globalLabel')}</span>
            <div className={styles.sessionTotals}>
              <span className={styles.smeta}>
                <span className={styles.smetaL}>IN </span>
                <span className={clsx(styles.smetaV, styles.in)}>{fmt(sessionTotals.tIn)}</span>
              </span>
              <span className={styles.smeta}>
                <span className={styles.smetaL}>OUT </span>
                <span className={clsx(styles.smetaV, styles.out)}>{fmt(sessionTotals.tOut)}</span>
              </span>
              <span className={styles.smeta}>
                <span className={styles.smetaL}>CR </span>
                <span className={clsx(styles.smetaV, styles.cr)}>{fmt(sessionTotals.tCR)}</span>
              </span>
              <span className={styles.smeta}>
                <span className={styles.smetaL}>CC </span>
                <span className={clsx(styles.smetaV, styles.cc)}>{fmt(sessionTotals.tCC)}</span>
              </span>
              <span className={styles.smeta}>
                <span className={styles.smetaL}>TURN </span>
                <span className={styles.smetaV}>{sessionTotals.assistantCount}</span>
              </span>
            </div>
          </div>
        </Tooltip>
      )}

      {isLoading ? (
        <div className={styles.sessionMetaSkeleton} />
      ) : (
        <div className={styles.sessionMeta}>
          <span className={styles.smeta}>
            <span className={styles.smetaL}>IN </span>
            <span className={clsx(styles.smetaV, styles.in)}>{fmt(totals.tIn)}</span>
          </span>
          <span className={styles.smeta}>
            <span className={styles.smetaL}>OUT </span>
            <span className={clsx(styles.smetaV, styles.out)}>{fmt(totals.tOut)}</span>
          </span>
          <span className={styles.smeta}>
            <span className={styles.smetaL}>CR </span>
            <span className={clsx(styles.smetaV, styles.cr)}>{fmt(totals.tCR)}</span>
          </span>
          <span className={styles.smeta}>
            <span className={styles.smetaL}>CC </span>
            <span className={clsx(styles.smetaV, styles.cc)}>{fmt(totals.tCC)}</span>
          </span>
          <span className={styles.smeta}>
            <span className={styles.smetaL}>TURN </span>
            <span className={styles.smetaV}>{totals.count}</span>
          </span>
        </div>
      )}
    </div>
  );
}
