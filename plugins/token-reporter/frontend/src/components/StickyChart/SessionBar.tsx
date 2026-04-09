import {useCallback, useMemo, useState} from 'react';
import clsx from 'clsx';
import {useSessionStore} from '../../stores/sessionStore';
import {useChartStore} from '../../stores/chartStore';
import {fmt} from '../../utils/format';
import {useI18n} from '../../i18n';
import Dropdown from '../common/Dropdown';
import type {DropdownOption} from '../common/Dropdown';
import Tooltip from '../common/Tooltip';
import styles from './SessionBar.module.scss';

export default function SessionBar() {
  const {t} = useI18n();
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadSession = useSessionStore((s) => s.loadSession);
  const turns = useSessionStore((s) => s.turns);
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);

  const [copied, setCopied] = useState(false);

  const sessionOptions: DropdownOption[] = useMemo(
    () =>
      sessions.map((s) => {
        const time = `${s.mtime.slice(0, 10)} ${s.mtime.slice(11, 16)}`;
        const title = s.customTitle || s.slug || s.sessionId;
        const shortId = s.sessionId.slice(0, 8);
        return {value: s.sessionId, label: `${time} \u00b7 ${title}`, sub: shortId};
      }),
    [sessions],
  );

  const handleSessionChange = useCallback(
    (val: string) => {
      loadSession(val);
    },
    [loadSession],
  );

  const handleCopy = useCallback(() => {
    if (!activeSessionId) return;
    navigator.clipboard.writeText(activeSessionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeSessionId]);

  const totals = useMemo(() => {
    const N = turns.length;
    if (N === 0) return {tIn: 0, tOut: 0, tCR: 0, tCC: 0, count: 0};
    const lo = Math.round(brushL * (N - 1));
    const hi = Math.round(brushR * (N - 1));
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

  return (
    <div className={styles.sessionBar}>
      <div className={styles.sessionSelectContainer}>
        <Dropdown
          options={sessionOptions}
          value={activeSessionId ?? ''}
          onChange={handleSessionChange}
          size="md"
          maxHeight={320}
          matchWidth
          className={styles.sessionDropdown}
        />
        <Tooltip content={t('session.copySessionId')}>
          <button
            className={clsx(styles.sessionCopyBtn, copied && styles.copied)}
            onClick={handleCopy}
          >
            {copied ? t('session.copiedId') : t('session.copyId')}
          </button>
        </Tooltip>
      </div>

      <div className={styles.sessionMeta}>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>{t('session.in')} </span>
          <span className={clsx(styles.smetaV, styles.in)}>{fmt(totals.tIn)}</span>
        </span>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>{t('session.out')} </span>
          <span className={clsx(styles.smetaV, styles.out)}>{fmt(totals.tOut)}</span>
        </span>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>{t('session.cr')} </span>
          <span className={clsx(styles.smetaV, styles.cr)}>{fmt(totals.tCR)}</span>
        </span>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>{t('session.cc')} </span>
          <span className={clsx(styles.smetaV, styles.cc)}>{fmt(totals.tCC)}</span>
        </span>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>{t('session.turns')} </span>
          <span className={styles.smetaV}>{totals.count}</span>
        </span>
      </div>
    </div>
  );
}
