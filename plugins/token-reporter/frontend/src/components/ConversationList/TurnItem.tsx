import React, {useCallback} from 'react';
import type {TurnItem as TurnItemType, SubagentStats} from '../../types/state';
import {useChartStore} from '../../stores/chartStore';
import {UserMessage} from './UserMessage';
import {AssistantMessage} from './AssistantMessage';
import {ToolGroup} from './ToolGroup';
import s from './TurnItem.module.scss';

interface TurnItemProps {
  turn: TurnItemType;
  subagents: Record<string, SubagentStats>;
}

export const TurnItem: React.FC<TurnItemProps> = React.memo(({turn, subagents}) => {
  const hoveredId = useChartStore((st) => st.hoveredId);
  const setHovered = useChartStore((st) => st.setHovered);

  const isHovered = hoveredId === turn.id;
  const hasUser = (turn.user || '').trim().length > 0;

  const handleMouseEnter = useCallback(() => {
    setHovered(turn.id);
  }, [turn.id, setHovered]);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
  }, [setHovered]);

  return (
    <div
      id={`turn-${turn.id}`}
      data-turn-id={turn.id}
      className={s.turnWrap}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {hasUser && <UserMessage turn={turn} isHovered={isHovered} />}
      <AssistantMessage turn={turn} hasUser={hasUser} isHovered={isHovered} />
      <ToolGroup turn={turn} subagents={subagents} />
    </div>
  );
});

TurnItem.displayName = 'TurnItem';
