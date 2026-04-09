import React from 'react';
import clsx from 'clsx';
import type {ToolItem} from '../../types/state';
import {useI18n} from '../../i18n';
import {fmtDur, fmtBytes, parseDur, parseSize} from '../../utils/format';
import s from './ToolGroup.module.scss';

interface ToolStatsPanelProps {
  tools: ToolItem[];
}

export const ToolStatsPanel: React.FC<ToolStatsPanelProps> = React.memo(({tools}) => {
  const {t} = useI18n();
  const total = tools.length;
  const errCount = tools.filter((t) => t.isErr).length;
  const okCount = total - errCount;
  const totalMs = tools.reduce((acc, t) => acc + parseDur(t.dur), 0);
  const totalBytes = tools.reduce((acc, t) => acc + parseSize(t.retSize), 0);

  const slowest = tools.reduce((a, b) => (parseDur(a.dur) >= parseDur(b.dur) ? a : b));
  const biggest = tools
    .filter((t) => parseSize(t.retSize) > 0)
    .reduce((a, b) => (parseSize(a.retSize) >= parseSize(b.retSize) ? a : b), tools[0]!);

  return (
    <div className={s.tcStatsPanel}>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.total')}</div>
        <div className={s.tsVal}>{total}</div>
      </div>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.ok')}</div>
        <div className={clsx(s.tsVal, s.ok)}>{okCount}</div>
      </div>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.err')}</div>
        <div className={clsx(s.tsVal, errCount ? s.err : s.ok)}>{errCount}</div>
      </div>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.duration')}</div>
        <div className={clsx(s.tsVal, s.time)}>{fmtDur(totalMs)}</div>
      </div>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.slowest')}</div>
        <div className={clsx(s.tsVal, s.time)}>
          {slowest.name} {slowest.dur}
        </div>
      </div>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.totalRet')}</div>
        <div className={clsx(s.tsVal, s.size)}>{fmtBytes(totalBytes)}</div>
      </div>
      <div className={s.tsItem}>
        <div className={s.tsLabel}>{t('toolStats.largest')}</div>
        <div className={clsx(s.tsVal, s.size)}>
          {biggest.name} {biggest.retSize}
        </div>
      </div>
    </div>
  );
});

ToolStatsPanel.displayName = 'ToolStatsPanel';
