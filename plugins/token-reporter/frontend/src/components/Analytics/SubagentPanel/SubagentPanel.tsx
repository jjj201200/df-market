import {useMemo} from 'react';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeSubagentEfficiency} from '../../../utils/analytics';
import {fmtUsd, fmtTokens, fmtPct as pct} from '../../../utils/format';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import StatCard from '../common/StatCard';
import s from './SubagentPanel.module.scss';

export default function SubagentPanel() {
  const turns = useSessionStore((st) => st.turns);
  const subagents = useSessionStore((st) => st.subagents);
  const sa = useMemo(() => computeSubagentEfficiency(subagents, turns), [subagents, turns]);

  if (sa.agents.length === 0) {
    return (
      <Panel>
        <div className={s.empty}>No subagents in this session.</div>
      </Panel>
    );
  }

  return (
    <Panel>
      <CardGrid>
        <StatCard label="Main Session Cost" value={fmtUsd(sa.mainTokens.cost)} sub={`${sa.mainTokens.turns} turns`} />
        <StatCard label="Total Subagent Cost" value={fmtUsd(sa.totalSubagentCost)} sub={`${sa.agents.length} agents`} />
        <StatCard
          label="Subagent Cost %"
          value={pct(sa.subagentCostPct)}
          color={sa.subagentCostPct > 0.5 ? 'var(--warning)' : undefined}
        />
      </CardGrid>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Type</th>
              <th>Turns</th>
              <th>Input</th>
              <th>Output</th>
              <th>Cache R</th>
              <th>Cache C</th>
              <th>Cost</th>
              <th>Tok/Turn</th>
            </tr>
          </thead>
          <tbody>
            <tr className={s.mainRow}>
              <td>Main Session</td>
              <td>-</td>
              <td>{sa.mainTokens.turns}</td>
              <td>{fmtTokens(sa.mainTokens.input)}</td>
              <td>{fmtTokens(sa.mainTokens.output)}</td>
              <td>{fmtTokens(sa.mainTokens.cacheR)}</td>
              <td>{fmtTokens(sa.mainTokens.cacheC)}</td>
              <td>{fmtUsd(sa.mainTokens.cost)}</td>
              <td>
                {sa.mainTokens.turns > 0
                  ? fmtTokens(
                      (sa.mainTokens.input + sa.mainTokens.output + sa.mainTokens.cacheR + sa.mainTokens.cacheC) /
                        sa.mainTokens.turns
                    )
                  : '-'}
              </td>
            </tr>
            {sa.agents.map((a) => (
              <tr key={a.agentId}>
                <td title={a.description}>{a.agentId.slice(0, 8)}</td>
                <td>{a.agentType || '-'}</td>
                <td>{a.turns}</td>
                <td>{fmtTokens(a.tokens.input)}</td>
                <td>{fmtTokens(a.tokens.output)}</td>
                <td>{fmtTokens(a.tokens.cacheR)}</td>
                <td>{fmtTokens(a.tokens.cacheC)}</td>
                <td>{fmtUsd(a.cost)}</td>
                <td>{fmtTokens(a.tokensPerTurn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
