import {useMemo} from 'react';
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeToolEfficiency, computeSidechainMetrics} from '../../../utils/analytics';
import {
  tooltipStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  cursorStyle,
  gridStroke,
  axisTickStyle,
  cssVar,
} from '../../../utils/chartTheme';
import {fmtUsd, fmtPct as pct} from '../../../utils/format';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import s from './ToolsPanel.module.scss';

export default function ToolsPanel() {
  const turns = useSessionStore((st) => st.turns);
  const tools = useMemo(() => computeToolEfficiency(turns), [turns]);
  const sidechain = useMemo(() => computeSidechainMetrics(turns), [turns]);

  const errorChartData = Object.entries(tools.errorsByClass)
    .filter(([, v]) => v.total > 0)
    .map(([cls, v]) => ({cls, total: v.total, errors: v.errors, rate: Math.round(v.rate * 100)}))
    .sort((a, b) => b.total - a.total);

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label="Total Tool Calls" value={String(tools.totalCalls)} />
        <StatCard
          label="Error Rate"
          value={pct(tools.errorRate)}
          sub={`${tools.totalErrors} failed`}
          color={tools.errorRate > 0.15 ? 'var(--danger)' : undefined}
        />
        <StatCard label="Redundant Groups" value={String(tools.redundantGroups.length)} />
        <StatCard label="Large Returns (>50KB)" value={String(tools.largeCalls.length)} />
      </CardGrid>

      {/* Error rate by tool class */}
      {errorChartData.length > 0 && (
        <ChartBox title="Tool Calls & Errors by Category">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={errorChartData} margin={{top: 4, right: 12, bottom: 4, left: 50}} layout="vertical">
              <CartesianGrid horizontal={false} stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis type="number" tick={axisTickStyle()} />
              <YAxis type="category" dataKey="cls" tick={axisTickStyle()} width={45} />
              <Tooltip
                contentStyle={tooltipStyle()}
                labelStyle={tooltipLabelStyle()}
                itemStyle={tooltipItemStyle()}
                cursor={cursorStyle()}
              />
              <Bar dataKey="total" fill={cssVar('--accent') || '#58a6ff'} radius={[0, 4, 4, 0]} name="Total" />
              <Bar dataKey="errors" fill={cssVar('--danger') || '#f85149'} radius={[0, 4, 4, 0]} name="Errors" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      {/* Redundant tool calls */}
      {tools.redundantGroups.length > 0 && (
        <ChartBox title="Redundant Tool Calls">
          <div className={s.list}>
            {tools.redundantGroups.slice(0, 10).map((g, i) => (
              <div key={i} className={s.redundantItem}>
                <span className={s.redundantCls}>{g.cls}</span>
                <span className={s.redundantKey} title={g.keyParam}>
                  {g.keyParam.length > 200 ? g.keyParam.slice(0, 200) + '...' : g.keyParam}
                </span>
                <span className={s.redundantCount}>x{g.count}</span>
                <span className={s.redundantTurns}>turns: {g.turnIds.join(', ')}</span>
              </div>
            ))}
          </div>
        </ChartBox>
      )}

      {/* Large returns */}
      {tools.largeCalls.length > 0 && (
        <ChartBox title="Large Tool Returns (&gt;50KB)">
          <div className={s.list}>
            {tools.largeCalls.slice(0, 10).map((lc, i) => (
              <div key={i} className={s.largeItem}>
                <span className={s.largeTool}>{lc.toolName}</span>
                <span className={s.largeSize}>{lc.retSize}</span>
                <span className={s.largeTurn}>Turn #{lc.turnId}</span>
              </div>
            ))}
          </div>
        </ChartBox>
      )}

      {/* Sidechain analysis */}
      {sidechain.sidechainTurns > 0 && (
        <ChartBox title="Sidechain Calls">
          <CardGrid minWidth={130}>
            <StatCard
              label="Sidechain Turns"
              value={String(sidechain.sidechainTurns)}
              sub={`${(sidechain.sidechainPct * 100).toFixed(1)}% of total`}
            />
            <StatCard
              label="Sidechain Cost"
              value={fmtUsd(sidechain.sidechainCost)}
              sub={`${(sidechain.sidechainCostPct * 100).toFixed(1)}% of total`}
              color={sidechain.sidechainCostPct > 0.4 ? 'var(--warning)' : undefined}
            />
          </CardGrid>
        </ChartBox>
      )}
    </Panel>
  );
}
