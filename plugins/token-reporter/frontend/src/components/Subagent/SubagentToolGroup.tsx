import React from 'react';
import type {ToolItem} from '../../types/state';
import {TOOL_COLORS} from '../../types/toolColors';
import s from './SubagentSummary.module.scss';

interface SubagentToolGroupProps {
  tools: ToolItem[];
}

export const SubagentToolGroup: React.FC<SubagentToolGroupProps> = ({tools}) => {
  const errCount = tools.filter((t) => t.isErr).length;

  return (
    <div className={s.saToolsGroup}>
      {errCount > 0 && <div className={s.saToolsErr}>{errCount} ERR</div>}
      <div>
        {tools.map((t, i) => (
          <div key={i} className={s.saToolItem}>
            <span className={s.saToolName} style={{color: TOOL_COLORS[t.cls] ?? TOOL_COLORS.other}}>
              {t.name}
            </span>
            <span className={s.saToolParams}>{t.params}</span>
            <span className={s.saToolMeta}>
              <span className={s.saToolDur}>{t.dur}</span>
              <span className={s.saToolSize}>{t.retSize}</span>
              <span className={`${s.saToolSt} ${t.status === 'ok' ? s.ok : s.err}`}>{t.status.toUpperCase()}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
