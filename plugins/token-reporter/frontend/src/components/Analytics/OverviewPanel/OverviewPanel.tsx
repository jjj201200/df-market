import {useMemo} from 'react';
import {PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeSessionCost} from '../../../utils/cost';
import {fmtUsd, fmtTokens, fmtPct} from '../../../utils/format';
import {
  computeCacheMetrics,
  computeToolEfficiency,
  computeContextGrowth,
  computeSubagentEfficiency,
  computeModelBreakdown,
  computeThinkingMetrics,
  computeSidechainMetrics,
  computeTimingMetrics,
  generateRecommendations,
} from '../../../utils/analytics';
import {tokenColors, toolColors, MODEL_COLORS, tooltipStyle, tooltipLabelStyle, tooltipItemStyle, cursorStyle, gridStroke, axisTickStyle} from '../../../utils/chartTheme';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartGrid from '../common/ChartGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import ColoredBar from '../common/ColoredBar';
import RecommendationCard from './RecommendationCard';
import s from './OverviewPanel.module.scss';

export default function OverviewPanel() {
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const subagents = useSessionStore((st) => st.subagents);

  const cost = useMemo(() => computeSessionCost(turns), [turns]);
  const cache = useMemo(() => computeCacheMetrics(turns), [turns]);
  const tools = useMemo(() => computeToolEfficiency(turns), [turns]);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);
  const subagent = useMemo(() => computeSubagentEfficiency(subagents, turns), [subagents, turns]);
  const modelBreakdown = useMemo(() => computeModelBreakdown(turns), [turns]);
  const thinking = useMemo(() => computeThinkingMetrics(turns, modelBreakdown.dominantModelId), [turns, modelBreakdown.dominantModelId]);
  const sidechain = useMemo(() => computeSidechainMetrics(turns), [turns]);
  const timing = useMemo(() => computeTimingMetrics(turns, cost.total), [turns, cost.total]);
  const recommendations = useMemo(
    () => generateRecommendations({cache, tools, context, subagent, cost, modelBreakdown, thinking, sidechain, timing}),
    [cache, tools, context, subagent, cost, modelBreakdown, thinking, sidechain, timing]
  );

  const tc = tokenColors();

  // Recharts reads `fill` from data entries for Pie
  const pieData = [
    {name: 'Input', value: cost.byType.input, fill: tc.input},
    {name: 'Output', value: cost.byType.output, fill: tc.output},
    {name: 'Cache Read', value: cost.byType.cacheRead, fill: tc.cacheRead},
    {name: 'Cache Create', value: cost.byType.cacheCreation, fill: tc.cacheCreation},
  ].filter((d) => d.value > 0);

  const tlc = toolColors();
  const toolCostMap: Record<string, number> = {};
  for (const t of turns) {
    for (const tool of t.tools) {
      toolCostMap[tool.cls] = (toolCostMap[tool.cls] ?? 0) + 1;
    }
  }
  const toolBarData = Object.entries(toolCostMap)
    .map(([cls, count]) => ({cls, count, color: (tlc as Record<string, string>)[cls] ?? '#666'}))
    .sort((a, b) => b.count - a.count);

  const totalTokens = turns.reduce((sum, t) => sum + t.input + t.output + t.cacheR + t.cacheC, 0);

  return (
    <Panel>
      {/* Summary Cards */}
      <CardGrid>
        <StatCard label="Total Cost" value={fmtUsd(cost.total)} sub={`${turns.length} turns`} />
        <StatCard label="Total Tokens" value={fmtTokens(totalTokens)} />
        <StatCard label="Avg / Turn" value={fmtUsd(cost.avgPerTurn)} />
        <StatCard
          label="Most Expensive Turn"
          value={`#${cost.maxTurnIdx + 1}`}
          sub={fmtUsd(cost.maxTurnCost)}
          color="var(--danger)"
        />
        {thinking.turnsWithThinking > 0 && (
          <StatCard
            label="Thinking Turns"
            value={`${thinking.turnsWithThinking}/${thinking.turnsTotal}`}
            sub={fmtPct(thinking.thinkingPct)}
          />
        )}
        {thinking.estimatedThinkingCost > 0 && (
          <StatCard
            label="Est. Thinking Cost"
            value={fmtUsd(thinking.estimatedThinkingCost)}
            sub={`~${fmtTokens(thinking.estimatedThinkingTokens)} tokens`}
            color={cost.total > 0 && thinking.estimatedThinkingCost / cost.total > 0.3 ? 'var(--danger)' : undefined}
          />
        )}
      </CardGrid>

      {/* Charts Row */}
      <ChartGrid>
        {/* Cost by Token Type (Donut) */}
        <ChartBox title="Cost by Token Type">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none" isAnimationActive={false} />
              <Tooltip
                contentStyle={tooltipStyle()}
                labelStyle={tooltipLabelStyle()}
                itemStyle={tooltipItemStyle()}
                formatter={(value) => fmtUsd(Number(value))}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className={s.legend}>
            {pieData.map((d) => (
              <span key={d.name} className={s.legendItem}>
                <span className={s.dot} style={{background: d.fill}} />
                {d.name}: {fmtUsd(d.value)}
              </span>
            ))}
          </div>
        </ChartBox>

        {/* Tool Call Distribution */}
        <ChartBox title="Tool Calls by Category">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toolBarData} layout="vertical" margin={{top: 4, right: 12, bottom: 4, left: 50}}>
              <CartesianGrid horizontal={false} stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis type="number" tick={axisTickStyle()} />
              <YAxis type="category" dataKey="cls" tick={axisTickStyle()} width={45} />
              <Tooltip contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle()} itemStyle={tooltipItemStyle()} cursor={cursorStyle()} />
              <Bar dataKey="count" shape={<ColoredBar />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </ChartGrid>

      {/* Model Breakdown */}
      {modelBreakdown.models.length > 1 && (
        <ChartGrid>
          <ChartBox title="Cost by Model">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={modelBreakdown.models.map((m, i) => ({
                    name: m.displayName,
                    value: m.cost,
                    fill: MODEL_COLORS[i % MODEL_COLORS.length],
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  labelStyle={tooltipLabelStyle()}
                  itemStyle={tooltipItemStyle()}
                  formatter={(value) => fmtUsd(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={s.legend}>
              {modelBreakdown.models.map((m, i) => (
                <span key={m.model} className={s.legendItem}>
                  <span className={s.dot} style={{background: MODEL_COLORS[i % MODEL_COLORS.length]}} />
                  {m.displayName}: {fmtUsd(m.cost)} ({fmtPct(m.costPct)})
                </span>
              ))}
            </div>
          </ChartBox>
          <ChartBox title="Model Details">
            <table className={s.modelTable}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Turns</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                  <th>$/Turn</th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.models.map((m) => (
                  <tr key={m.model}>
                    <td className={s.modelName}>{m.displayName}</td>
                    <td>{m.turns}</td>
                    <td>{fmtTokens(m.tokens.input + m.tokens.output + m.tokens.cacheR + m.tokens.cacheC)}</td>
                    <td>{fmtUsd(m.cost)}</td>
                    <td>{fmtUsd(m.avgCostPerTurn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {modelBreakdown.modelSwitches > 0 && (
              <div className={s.modelSwitches}>
                Model switches: {modelBreakdown.modelSwitches}
              </div>
            )}
          </ChartBox>
        </ChartGrid>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className={s.recsSection}>
          <div className={s.recsTitle}>Recommendations</div>
          <div className={s.recs}>
            {recommendations.map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
