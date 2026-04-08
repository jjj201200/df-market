import React, {useCallback} from 'react';
import {useUIStore} from '../../stores/uiStore';
import s from './ThinkingBlock.module.scss';

interface ThinkingBlockProps {
  id: string;
  text: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = React.memo(({id, text}) => {
  const expanded = useUIStore((st) => st.expandedThinking.has(id));
  const toggleThinking = useUIStore((st) => st.toggleThinking);

  const handleToggle = useCallback(() => {
    toggleThinking(id);
  }, [id, toggleThinking]);

  const estimatedTokens = Math.ceil(text.length / 4);

  return (
    <div className={s.thinkingBlock}>
      <div className={s.thinkingHeader} onClick={handleToggle}>
        <span className={s.thinkingIcon}>🧠</span>
        <span>Internal reasoning</span>
        <span className={s.thinkingEstimate}>{estimatedTokens} tokens (est.)</span>
        <span className={s.thinkingToggle}>{expanded ? '▼ Collapse' : '▶ Expand'}</span>
      </div>
      {expanded && <div className={s.thinkingBody}>{text}</div>}
    </div>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';
