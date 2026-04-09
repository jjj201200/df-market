import React from 'react';
import clsx from 'clsx';
import s from './ToolPills.module.scss';

const PILL_CLASS: Record<string, string> = {
  bash: 'tpBash',
  read: 'tpRead',
  edit: 'tpEdit',
  write: 'tpWrite',
  grep: 'tpGrep',
  glob: 'tpGlob',
  web: 'tpWeb',
  agent: 'tpAgent',
  mcp: 'tpMcp',
  toolsearch: 'tpToolsearch',
  other: 'tpOther',
};

interface ToolPillsProps {
  counts: Record<string, number>;
}

export const ToolPills: React.FC<ToolPillsProps> = ({counts}) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <span className={s.toolPills}>
      {entries.map(([cls, n]) => (
        <span className={clsx(s.toolPill, s[PILL_CLASS[cls] || 'tpOther'])} key={cls}>
          {cls.toUpperCase()}&times;{n}
        </span>
      ))}
    </span>
  );
};
