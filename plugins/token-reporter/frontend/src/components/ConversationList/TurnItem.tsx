import React, {useCallback, useRef, useState} from 'react';
import type {TurnItem as TurnItemType, SubagentStats} from '../../types/state';
import {useChartStore} from '../../stores/chartStore';
import {UserMessage} from './UserMessage';
import {AssistantMessage} from './AssistantMessage';
import {ToolGroup} from './ToolGroup';
import clsx from 'clsx';
import s from './TurnItem.module.scss';

interface TurnItemProps {
  turn: TurnItemType;
  subagents: Record<string, SubagentStats>;
}

export const TurnItem: React.FC<TurnItemProps> = React.memo(({turn, subagents}) => {
  const hoveredId = useChartStore((st) => st.hoveredId);
  const selectedId = useChartStore((st) => st.selectedId);
  const setHovered = useChartStore((st) => st.setHovered);
  const setSelected = useChartStore((st) => st.setSelected);

  const isHovered = hoveredId === turn.id;
  const isSelected = selectedId === turn.id;
  const hasUser = (turn.user || '').trim().length > 0;

  const [isFadingOut, setIsFadingOut] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const handleMouseEnter = useCallback(() => {
    setHovered(turn.id);
    if (isSelected) {
      hoverTimerRef.current = setTimeout(() => {
        setIsFadingOut(true);
        fadeTimerRef.current = setTimeout(() => {
          setSelected(null);
          setIsFadingOut(false);
        }, 400);
      }, 1000);
    }
  }, [turn.id, setHovered, isSelected, setSelected]);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    clearTimers();
    if (isFadingOut) {
      setIsFadingOut(false);
    }
  }, [setHovered, isFadingOut]);

  return (
    <div
      id={`turn-${turn.id}`}
      data-turn-id={turn.id}
      className={clsx(s.turnWrap, (isSelected || isFadingOut) && s.selected, isFadingOut && s.selectedFadeOut)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={s.highlightRing} />
      {hasUser && <UserMessage turn={turn} isHovered={isHovered} />}
      <AssistantMessage turn={turn} hasUser={hasUser} isHovered={isHovered} />
      <ToolGroup turn={turn} subagents={subagents} />
    </div>
  );
});

TurnItem.displayName = 'TurnItem';
