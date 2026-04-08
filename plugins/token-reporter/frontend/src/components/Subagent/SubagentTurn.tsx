import React from 'react';
import type {SubagentTurnItem} from '../../types/state';
import {CopyButton} from '../common/CopyButton';
import {SubagentToolGroup} from './SubagentToolGroup';
import s from './SubagentSummary.module.scss';

const TOOL_PILL_COLORS: Record<string, string> = {
  bash: '#e3b341',
  read: '#58a6ff',
  edit: '#f0883e',
  write: '#bc8cff',
  grep: '#3fb950',
  glob: '#8b949e',
  web: '#58a6ff',
  agent: '#d2a8ff',
  mcp: '#79c0ff',
  other: '#484f58',
};

interface SubagentTurnProps {
  turn: SubagentTurnItem;
}

export const SubagentTurn: React.FC<SubagentTurnProps> = ({turn}) => {
  const userText = turn.userText || '';
  const assistantText = turn.assistantText || '';
  const hasUser = userText.trim().length > 0;
  const hasAssistant = assistantText.trim().length > 0;

  // Build tool summary pills
  const toolCounts: Record<string, {count: number; cls: string}> = {};
  for (const t of turn.tools || []) {
    const key = t.name;
    if (!toolCounts[key]) {
      toolCounts[key] = {count: 0, cls: t.cls};
    }
    toolCounts[key]!.count++;
  }

  return (
    <div className={s.saTurn}>
      <div className={s.saTurnBody}>
        <div className={s.saTurnHeader}>
          <span className={s.saTurnNum}>Turn {turn.id}</span>
          {Object.keys(toolCounts).length > 0 && (
            <div className={s.saTurnToolsSummary}>
              {Object.entries(toolCounts).map(([name, info]) => (
                <span
                  key={name}
                  className={s.saToolPill}
                  style={{color: TOOL_PILL_COLORS[info.cls] ?? TOOL_PILL_COLORS.other}}
                >
                  {name}
                  {info.count > 1 ? `\u00d7${info.count}` : ''}
                </span>
              ))}
            </div>
          )}
          <span className={s.saTurnTime}>{turn.time}</span>
        </div>

        {hasUser && (
          <div className={`${s.saSection} ${s.saSectionUser}`}>
            <div className={s.saScrollableContent}>{userText}</div>
            <CopyButton getText={() => userText} />
          </div>
        )}

        {hasAssistant && (
          <div className={`${s.saSection} ${s.saSectionAssistant}`}>
            <div className={s.saScrollableContent}>{assistantText}</div>
            <CopyButton getText={() => assistantText} />
          </div>
        )}
      </div>

      {turn.tools && turn.tools.length > 0 && <SubagentToolGroup tools={turn.tools} />}
    </div>
  );
};
