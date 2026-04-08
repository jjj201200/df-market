import React from 'react';
import type {SubagentStats} from '../../types/state';
import {useUIStore} from '../../stores/uiStore';
import {TOOL_COLORS} from '../../types/toolColors';
import {TokenBadges} from '../common/TokenBadges';
import {SubagentTurn} from './SubagentTurn';
import s from './SubagentSummary.module.scss';

interface SubagentCardProps {
  subagent: SubagentStats;
  turnId: number;
  toolIndex: number;
}

export const SubagentCard: React.FC<SubagentCardProps> = ({subagent, turnId, toolIndex}) => {
  const saId = `sa-${turnId}-${toolIndex}-${subagent.agentId}`;
  const expanded = useUIStore((st) => st.expandedSubagents.has(saId));
  const toggleSubagent = useUIStore((st) => st.toggleSubagent);
  const hasTurns = subagent.turns && subagent.turns.length > 0;
  const toolCounts = subagent.toolCounts || {};
  const toolPills = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className={s.saCard}>
      <div className={s.saCardHeader}>
        <div className={s.saCardLeft}>
          <span className={s.saType}>{subagent.agentType}</span>
          <span className={s.saId}>{subagent.agentId.slice(0, 8)}</span>
          <span className={s.saTurnsCount}>
            {subagent.totalTurns} turn{subagent.totalTurns === 1 ? '' : 's'}
          </span>
          {toolPills.length > 0 && (
            <span className={s.saTools}>
              {toolPills.map(([cls, count]) => (
                <span key={cls} className={s.toolPill} style={{color: TOOL_COLORS[cls] ?? TOOL_COLORS.other}}>
                  {cls.toUpperCase()}&times;{count}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className={s.saTokens}>
          <TokenBadges
            input={subagent.totalTokens.input}
            output={subagent.totalTokens.output}
            cacheR={subagent.totalTokens.cacheR}
            cacheC={subagent.totalTokens.cacheC}
          />
        </div>
      </div>

      {subagent.description && <div className={s.saDesc}>{subagent.description}</div>}

      {hasTurns && (
        <div className={s.saExpandRow} onClick={() => toggleSubagent(saId)}>
          <span className={`${s.arrow} ${expanded ? s.open : ''}`}>&#x25B6;</span>
          <span>View {subagent.totalTurns} turns</span>
        </div>
      )}

      {expanded && hasTurns && (
        <div className={s.saTurnsContainer}>
          {subagent.turns.map((turn, i) => (
            <SubagentTurn key={i} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
};
