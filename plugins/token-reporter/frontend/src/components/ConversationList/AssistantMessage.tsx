import React, {useCallback, useRef, useState, useLayoutEffect} from 'react';
import type {TurnItem} from '../../types/state';
import {useUIStore} from '../../stores/uiStore';
import {TokenBadges} from '../common/TokenBadges';
import {ThinkingBlock} from './ThinkingBlock';
import s from './TurnItem.module.scss';

interface AssistantMessageProps {
  turn: TurnItem;
  hasUser: boolean;
  isHovered: boolean;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = React.memo(({turn, hasUser, isHovered}) => {
  const textId = `at-${turn.id}`;
  const expanded = useUIStore((st) => st.expandedTexts.has(textId));
  const toggleText = useUIStore((st) => st.toggleText);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const handleToggle = useCallback(() => {
    toggleText(textId);
  }, [textId, toggleText]);

  const assistantText = turn.assistant || '';

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight);
  }, [assistantText]);

  const wrapCls = hasUser
    ? `${s.msgAssistant} ${isHovered ? s.barHover : ''}`
    : `${s.msgAsstLed} ${isHovered ? s.barHover : ''}`;

  return (
    <div className={wrapCls}>
      <div className={hasUser ? s.msgAssistantHeader : s.msgUserHeader}>
        <span className={s.roleBadgeAsst}>ASSISTANT</span>
        {!hasUser && turn.isSidechain && <span className={s.sidechainBadge}>SIDECHAIN</span>}
        <span className={s.msgTime}>{turn.time}</span>
        {turn.model && <span className={s.modelTag}>{turn.model}</span>}
        {!hasUser && <TokenBadges input={turn.input} output={turn.output} cacheR={turn.cacheR} cacheC={turn.cacheC} />}
      </div>
      {turn.thinking && <ThinkingBlock id={`th-${turn.id}`} text={turn.thinking} />}
      {assistantText && (
        <div className={s.msgBody}>
          <div ref={textRef} className={`${s.msgText} ${!expanded ? s.clamped : ''}`}>{assistantText}</div>
          {overflows && (
            <span className={s.expandBtn} onClick={handleToggle}>
              {expanded ? '▲ Collapse' : '▼ Expand all'}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

AssistantMessage.displayName = 'AssistantMessage';
