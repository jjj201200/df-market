import React, {useCallback, useMemo} from 'react';
import clsx from 'clsx';
import type {ToolItem, SubagentStats} from '../../types/state';
import {TOOL_COLORS, TOOL_NAME_COLORS} from '../../types/toolColors';
import {useUIStore} from '../../stores/uiStore';
import {CopyButton} from '../common/CopyButton';
import {SubagentCard} from '../Subagent/SubagentCard';
import s from './ToolCard.module.scss';

/** Map vc (value-class) string to CSS module class */
function getVcClass(vc: string): string {
  switch (vc) {
    case 'path':
      return s.path ?? '';
    case 'cmd':
      return s.cmd ?? '';
    case 'str':
      return s.str ?? '';
    case 'num':
      return s.num ?? '';
    case 'bool':
      return s.bool ?? '';
    default:
      return '';
  }
}

interface ToolCardProps {
  tool: ToolItem;
  detailId: string;
  turnId: number;
  toolIndex: number;
  subagents: Record<string, SubagentStats>;
}

export const ToolCard: React.FC<ToolCardProps> = React.memo(({tool, detailId, turnId, toolIndex, subagents}) => {
  const expanded = useUIStore((st) => st.expandedToolDetails.has(detailId));
  const toggleToolDetail = useUIStore((st) => st.toggleToolDetail);

  const handleToggle = useCallback(() => {
    toggleToolDetail(detailId);
  }, [detailId, toggleToolDetail]);

  const bandColor = TOOL_COLORS[tool.cls] || TOOL_COLORS.other;
  const nameColor = TOOL_NAME_COLORS[tool.cls] || TOOL_NAME_COLORS.other;

  // Find matching subagent for Agent tools
  const matchingSubagent = useMemo(() => {
    if (tool.name !== 'Agent' || !subagents || Object.keys(subagents).length === 0) {
      return null;
    }
    const descInput = tool.input?.find((p) => p.k === 'description');
    if (!descInput) return null;
    return Object.values(subagents).find((sa) => sa.description === descInput.v) ?? null;
  }, [tool.name, tool.input, subagents]);

  const getOutputText = useCallback(() => {
    return tool.output || '(no output)';
  }, [tool.output]);

  return (
    <div className={s.tcCard}>
      {/* Head */}
      <div className={s.tcHead}>
        <div className={s.tcBand} style={{background: bandColor}} />
        <div className={s.tcHeadInner}>
          <span className={s.tcName} style={{color: nameColor}}>
            {tool.name}
          </span>
          {tool.mcp && (
            <div className={s.tcMcpInfo}>
              <span className={s.tcMcpServer}>{tool.mcp.server}</span>
              <span className={s.tcMcpSep}>&rarr;</span>
              <span className={s.tcMcpMethod}>{tool.mcp.method}</span>
            </div>
          )}
          <span className={s.tcParamsSummary}>{tool.params}</span>
          <div className={s.tcMeta}>
            <span className={s.tcDur}>{tool.dur}</span>
            <span className={s.tcSize}>{tool.retSize}</span>
            <span className={clsx(s.tcSt, tool.status === 'ok' ? s.ok : s.err)}>{tool.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Subagent card (for Agent tools) */}
      {matchingSubagent && <SubagentCard subagent={matchingSubagent} turnId={turnId} toolIndex={toolIndex} />}

      {/* Expand row */}
      <div className={clsx(s.tcExpandRow, expanded && s.open)} onClick={handleToggle}>
        <span className={s.arrow}>▶</span>
        <span>Expand params &amp; output</span>
        {tool.retLines && tool.retLines !== '—' && <span className={s.retLinesHint}>{tool.retLines}</span>}
      </div>

      {/* Detail body */}
      {expanded && (
        <div className={s.tcDetailWrap}>
          <div className={s.tcDetailBody}>
            {tool.input && tool.input.length > 0 && (
              <>
                <div className={s.tcSectionLabel}>INPUT</div>
                {tool.input.map((p, pi) => (
                  <div className={s.tcParamRow} key={pi}>
                    <span className={s.tcPk}>{p.k}</span>
                    <span className={clsx(s.tcPv, getVcClass(p.vc))}>{p.v}</span>
                  </div>
                ))}
              </>
            )}
            <div className={s.tcResultBlock}>
              <div className={s.tcResultMeta}>
                <span>OUTPUT</span>
                <span className={s.rmBytes}>{tool.retSize}</span>
                {tool.retLines && tool.retLines !== '—' && <span className={s.rmLines}>{tool.retLines}</span>}
              </div>
              <div className={clsx(s.tcResultPreview, tool.isErr && s.isErr)}>
                <div className={s.tcResultText}>{tool.output || '(no output)'}</div>
                <CopyButton getText={getOutputText} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ToolCard.displayName = 'ToolCard';
