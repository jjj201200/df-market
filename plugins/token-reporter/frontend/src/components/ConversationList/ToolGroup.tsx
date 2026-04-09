import React, {useCallback, useMemo} from 'react';
import clsx from 'clsx';
import type {TurnItem, SubagentStats} from '../../types/state';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import {fmtDur, fmtBytes, parseDur, parseSize} from '../../utils/format';
import {ToolPills} from '../common/ToolPills';
import {ToolStatsPanel} from './ToolStatsPanel';
import {ToolCard} from './ToolCard';
import s from './ToolGroup.module.scss';
import {IconChevronRight} from '@tabler/icons-react';

interface ToolGroupProps {
  turn: TurnItem;
  subagents: Record<string, SubagentStats>;
}

export const ToolGroup: React.FC<ToolGroupProps> = React.memo(({turn, subagents}) => {
  const {t} = useI18n();
  const tools = turn.tools;
  if (!tools || tools.length === 0) return null;

  const groupId = `tc-${turn.id}`;
  const expanded = useUIStore((st) => st.expandedToolGroups.has(groupId));
  const toggleToolGroup = useUIStore((st) => st.toggleToolGroup);

  const handleToggle = useCallback(() => {
    toggleToolGroup(groupId);
  }, [groupId, toggleToolGroup]);

  const {total, errCount, totalMs, totalBytes, toolCounts} = useMemo(() => {
    const counts: Record<string, number> = {};
    let tMs = 0;
    let tBytes = 0;
    let errs = 0;

    for (const t of tools) {
      counts[t.cls] = (counts[t.cls] || 0) + 1;
      tMs += parseDur(t.dur);
      tBytes += parseSize(t.retSize);
      if (t.isErr) errs++;
    }

    return {
      total: tools.length,
      errCount: errs,
      totalMs: tMs,
      totalBytes: tBytes,
      toolCounts: counts,
    };
  }, [tools]);

  return (
    <div className={s.tcGroup}>
      <div className={s.tcToggle} onClick={handleToggle}>
        <span className={clsx(s.arrow, expanded && s.open)}><IconChevronRight size={14} stroke={1.5} /></span>
        <span className={s.tcBadge}>
          {total} {total === 1 ? t('conversation.toolCall') : t('conversation.toolCalls')}
        </span>
        <span className={s.tcSummary}>
          <ToolPills counts={toolCounts} />
          <span className={s.tcSumSep}>&middot;</span>
          <span className={s.tcSumTime}>{fmtDur(totalMs)}</span>
          <span className={s.tcSumSep}>&middot;</span>
          <span className={s.tcSumSize}>{fmtBytes(totalBytes)}</span>
          {errCount > 0 && (
            <>
              <span className={s.tcSumSep}>&middot;</span>
              <span className={s.tcSumErr}>{t('conversation.nErr', {count: errCount})}</span>
            </>
          )}
        </span>
      </div>

      {expanded && (
        <div className={s.tcList}>
          <ToolStatsPanel tools={tools} />
          {tools.map((tool, i) => (
            <ToolCard
              key={i}
              tool={tool}
              detailId={`tcd-${turn.id}-${i}`}
              turnId={turn.id}
              toolIndex={i}
              subagents={subagents}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ToolGroup.displayName = 'ToolGroup';
