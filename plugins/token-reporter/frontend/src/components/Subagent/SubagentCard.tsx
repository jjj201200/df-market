import React from 'react';
import type {SubagentStats} from '../../types/state';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import {ToolPills} from '../common/ToolPills';
import {TokenBadges} from '../common/TokenBadges';
import {SubagentTurn} from './SubagentTurn';
import s from './SubagentSummary.module.scss';
import {IconChevronRight} from '@tabler/icons-react';

interface SubagentCardProps {
  subagent: SubagentStats;
  turnId: number;
  toolIndex: number;
}

export const SubagentCard: React.FC<SubagentCardProps> = ({subagent, turnId, toolIndex}) => {
  const {t} = useI18n();
  const saId = `sa-${turnId}-${toolIndex}-${subagent.agentId}`;
  const expanded = useUIStore((st) => st.expandedSubagents.has(saId));
  const toggleSubagent = useUIStore((st) => st.toggleSubagent);
  const hasTurns = subagent.turns && subagent.turns.length > 0;
  const toolCounts = subagent.toolCounts || {};

  return (
    <div className={s.saCard}>
      <div className={s.saCardHeader}>
        <div className={s.saCardLeft}>
          <span className={s.saType}>{subagent.agentType}</span>
          <span className={s.saId}>{subagent.agentId.slice(0, 8)}</span>
          <span className={s.saTurnsCount}>
            {subagent.totalTurns === 1
              ? `${subagent.totalTurns} ${t('common.turn')}`
              : t('overview.nTurns', {count: subagent.totalTurns})}
          </span>
          <ToolPills counts={toolCounts} />
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
          <span className={`${s.arrow} ${expanded ? s.open : ''}`}><IconChevronRight size={14} stroke={1.5} /></span>
          <span>{t('conversation.viewTurns', {count: subagent.totalTurns})}</span>
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
