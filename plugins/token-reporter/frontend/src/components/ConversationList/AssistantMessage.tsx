import React, {useCallback, useRef, useState, useLayoutEffect} from 'react';
import clsx from 'clsx';
import type {TurnItem} from '../../types/state';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import {TokenBadges} from '../common/TokenBadges';
import {CopyButton} from '../common/CopyButton';
import {ThinkingBlock} from './ThinkingBlock';
import {MarkdownContent} from '../common/MarkdownContent';
import s from './TurnItem.module.scss';
import {IconChevronUp, IconChevronDown} from '@tabler/icons-react';

interface AssistantMessageProps {
  turn: TurnItem;
  hasUser: boolean;
  isHovered: boolean;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = React.memo(({turn, hasUser, isHovered}) => {
  const {t} = useI18n();
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

  const wrapCls = clsx(hasUser ? s.msgAssistant : s.msgAsstLed, isHovered && s.barHover);

  return (
    <div className={wrapCls}>
      <div className={hasUser ? s.msgAssistantHeader : s.msgUserHeader}>
        <span className={s.roleBadgeAsst}>{t('conversation.assistant')}</span>
        {!hasUser && turn.isSidechain && <span className={s.sidechainBadge}>{t('conversation.sidechain')}</span>}
        <span className={s.msgTime}>{turn.time}</span>
        {turn.model && <span className={s.modelTag}>{turn.model}</span>}
        {!hasUser && <TokenBadges input={turn.input} output={turn.output} cacheR={turn.cacheR} cacheC={turn.cacheC} />}
      </div>
      {turn.thinking && <ThinkingBlock id={`th-${turn.id}`} text={turn.thinking} />}
      {assistantText && (
        <div className={s.msgBody}>
          <div ref={textRef} className={clsx(s.msgText, !expanded && s.clamped)}>
            <MarkdownContent>{assistantText}</MarkdownContent>
          </div>
          {overflows && (
            <span className={s.expandBtn} onClick={handleToggle}>
              {expanded
                  ? <><IconChevronUp size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.collapse')}</>
                  : <><IconChevronDown size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.expandAll')}</>
                }
            </span>
          )}
          <CopyButton getText={() => assistantText} className={s.msgCopyBtn} />
        </div>
      )}
    </div>
  );
});

AssistantMessage.displayName = 'AssistantMessage';
