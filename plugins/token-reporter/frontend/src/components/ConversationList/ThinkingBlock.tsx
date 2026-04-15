import React, {useCallback} from 'react';
import {useI18n} from '../../i18n';
import {useUIStore} from '../../stores/uiStore';
import {MarkdownContent} from '../common/MarkdownContent';
import s from './ThinkingBlock.module.scss';
import {IconBrain, IconChevronDown, IconChevronRight} from '@tabler/icons-react';

interface ThinkingBlockProps {
  id: string;
  text: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = React.memo(({id, text}) => {
  const {t} = useI18n();
  const expanded = useUIStore((st) => st.expandedThinking.has(id));
  const toggleThinking = useUIStore((st) => st.toggleThinking);

  const handleToggle = useCallback(() => {
    toggleThinking(id);
  }, [id, toggleThinking]);

  const estimatedTokens = Math.ceil(text.length / 4);

  return (
    <div className={s.thinkingBlock}>
      <div className={s.thinkingHeader} onClick={handleToggle}>
        <span className={s.thinkingIcon}>
          <IconBrain size={14} stroke={1.5} />
        </span>
        <span>{t('conversation.internalReasoning')}</span>
        <span className={s.thinkingEstimate}>{t('conversation.tokensEst', {count: estimatedTokens})}</span>
        <span className={s.thinkingToggle}>
          {expanded ? (
            <>
              <IconChevronDown size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.collapse')}
            </>
          ) : (
            <>
              <IconChevronRight size={12} stroke={1.5} style={{verticalAlign: 'middle'}} /> {t('common.expand')}
            </>
          )}
        </span>
      </div>
      {expanded && (
        <div className={s.thinkingBody}>
          <MarkdownContent>{text}</MarkdownContent>
        </div>
      )}
    </div>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';
