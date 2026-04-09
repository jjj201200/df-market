import {useCallback, useMemo, useState} from 'react';
import clsx from 'clsx';
import {useSessionStore} from '../../stores/sessionStore';
import {useChartStore} from '../../stores/chartStore';
import {fmt} from '../../utils/format';
import styles from './SessionBar.module.scss';

export default function SessionBar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadSession = useSessionStore((s) => s.loadSession);
  const turns = useSessionStore((s) => s.turns);
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);

  const [copied, setCopied] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      loadSession(e.target.value);
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
        <select className={styles.sessionSelect} value={activeSessionId ?? ''} onChange={handleChange}>
          {sessions.map((s) => {
            const time = `${s.mtime.slice(0, 10)} ${s.mtime.slice(11, 16)}`;
            const title = s.customTitle || s.slug || s.sessionId;
            const shortId = s.sessionId.slice(0, 8);
            return (
              <option key={s.sessionId} value={s.sessionId}>
                {`${time} · ${title} (${shortId})`}
              </option>
            );
          })}
        </select>
        <button
          className={clsx(styles.sessionCopyBtn, copied && styles.copied)}
          onClick={handleCopy}
          title="Copy session ID"
        >
          {copied ? 'Copied!' : 'Copy ID'}
        </button>
      </div>

      <div className={styles.sessionMeta}>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>In </span>
          <span className={clsx(styles.smetaV, styles.in)}>{fmt(totals.tIn)}</span>
        </span>
        <span className={styles.smeta}>
          <span className={styles.smetaL}>Out </span>
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
          <span className={styles.smetaL}>Turns </span>
          <span className={styles.smetaV}>{totals.count}</span>
        </span>
      </div>
    </div>
  );
}
