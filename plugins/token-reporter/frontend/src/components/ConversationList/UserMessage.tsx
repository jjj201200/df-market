import React, {useCallback, useRef, useState, useLayoutEffect} from 'react';
import clsx from 'clsx';
import type {TurnItem} from '../../types/state';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import {TokenBadges} from '../common/TokenBadges';
import {CopyButton} from '../common/CopyButton';
import s from './TurnItem.module.scss';
import {IconChevronUp, IconChevronDown} from '@tabler/icons-react';

interface UserMessageProps {
  turn: TurnItem;
  isHovered: boolean;
}

export const UserMessage: React.FC<UserMessageProps> = React.memo(({turn, isHovered}) => {
  const {t} = useI18n();
  const textId = `ut-${turn.id}`;
  const expanded = useUIStore((st) => st.expandedTexts.has(textId));
  const toggleText = useUIStore((st) => st.toggleText);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const handleToggle = useCallback(() => {
    toggleText(textId);
  }, [textId, toggleText]);

  const userText = turn.user || '';

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight);
  }, [userText]);

  if (!userText.trim()) return null;

  const cls = clsx(s.msgUser, isHovered && s.barHover, turn.isSidechain && s.sidechain);

  return (
    <div className={cls}>
      <div className={s.msgUserHeader}>
        <span className={s.roleBadgeUser}>{t('conversation.user')}</span>
        {turn.isSidechain && <span className={s.sidechainBadge}>{t('conversation.sidechain')}</span>}
        <span className={s.msgTime}>{turn.time}</span>
        <TokenBadges input={turn.input} output={turn.output} cacheR={turn.cacheR} cacheC={turn.cacheC} />
      </div>
      <div className={s.msgBody}>
        <div ref={textRef} className={clsx(s.msgText, !expanded && s.clamped)}>{userText}</div>
        {overflows && (
          <span className={s.expandBtn} onClick={handleToggle}>
            {expanded
                ? <><IconChevronUp size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.collapse')}</>
                : <><IconChevronDown size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.expandAll')}</>
              }
          </span>
        )}
        <CopyButton getText={() => userText} className={s.msgCopyBtn} />
      </div>
    </div>
  );
});

UserMessage.displayName = 'UserMessage';
