import React, {useState} from 'react';
import clsx from 'clsx';
import type {SubagentStats} from '../../types/state';
import {ToolPills} from '../common/ToolPills';
import {TokenBadges} from '../common/TokenBadges';
import {SubagentTurn} from './SubagentTurn';
import s from './SubagentSummary.module.scss';
import {IconChevronRight} from '@tabler/icons-react';

const AGENT_TYPE_CLASS: Record<string, string> = {
  explore: 'saExplore',
  plan: 'saPlan',
  'general-purpose': 'saGeneralPurpose',
  'code-reviewer': 'saCodeReviewer',
};

interface SubagentSummaryProps {
  subagents: Record<string, SubagentStats>;
}

export const SubagentSummary: React.FC<SubagentSummaryProps> = ({subagents}) => {
  if (!subagents || Object.keys(subagents).length === 0) return null;

  return (
    <div className={s.subagentSummary}>
      <div className={s.subagentHeader}>
        <span className={s.subagentTitle}>Subagents</span>
      </div>
      <div className={s.subagentList}>
        {Object.entries(subagents).map(([agentId, stats]) => (
          <SubagentCardItem key={agentId} agentId={agentId} stats={stats} />
        ))}
      </div>
    </div>
  );
};

function SubagentCardItem({agentId, stats}: {agentId: string; stats: SubagentStats}) {
  const [expanded, setExpanded] = useState(false);
  const hasTurns = stats.turns && stats.turns.length > 0;
  const agentTypeLower = stats.agentType.toLowerCase();
  const typeClass = AGENT_TYPE_CLASS[agentTypeLower] ?? '';

  const toolCounts = stats.toolCounts || {};

  return (
    <div className={clsx(s.saCard, s[typeClass])}>
      <div className={s.saCardHeader}>
        <div className={s.saCardLeft}>
          <span className={s.saType}>{stats.agentType}</span>
          <span className={s.saId}>{agentId.slice(0, 8)}</span>
          <span className={s.saTurnsCount}>
            {stats.totalTurns} turn{stats.totalTurns === 1 ? '' : 's'}
          </span>
          <ToolPills counts={toolCounts} />
        </div>
        <div className={s.saTokens}>
          <TokenBadges
            input={stats.totalTokens.input}
            output={stats.totalTokens.output}
            cacheR={stats.totalTokens.cacheR}
            cacheC={stats.totalTokens.cacheC}
          />
        </div>
      </div>

      {stats.description && <div className={s.saDesc}>{stats.description}</div>}

      {hasTurns && (
        <div className={s.saExpandRow} onClick={() => setExpanded(!expanded)}>
          <span className={clsx(s.arrow, expanded && s.open)}><IconChevronRight size={14} stroke={1.5} /></span>
          <span>View {stats.totalTurns} turns</span>
        </div>
      )}

      {expanded && hasTurns && (
        <div className={s.saTurnsContainer}>
          {stats.turns.map((turn, i) => (
            <SubagentTurn key={i} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
}
