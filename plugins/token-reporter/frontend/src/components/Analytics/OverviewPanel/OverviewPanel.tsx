import {useMemo} from 'react';
import {PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeSessionCost} from '../../../utils/cost';
import {
  computeCacheMetrics,
  computeToolEfficiency,
  computeContextGrowth,
  computeSubagentEfficiency,
  generateRecommendations,
} from '../../../utils/analytics';
import {tokenColors, toolColors, tooltipStyle, tooltipLabelStyle, tooltipItemStyle, cursorStyle, gridStroke, axisTickStyle} from '../../../utils/chartTheme';
import StatCard from '../common/StatCard';
import RecommendationCard from './RecommendationCard';
import s from './OverviewPanel.module.scss';

function fmtUsd(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

// Custom bar shape that reads fill from data entry
function ColoredBar(props: Record<string, unknown>) {
  const {fill, x, y, width, height, color} = props as {
    fill: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
  };
  return <rect x={x} y={y} width={width} height={height} rx={4} fill={color ?? fill} />;
}

export default function OverviewPanel() {
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const subagents = useSessionStore((st) => st.subagents);

  const cost = useMemo(() => computeSessionCost(turns), [turns]);
  const cache = useMemo(() => computeCacheMetrics(turns), [turns]);
  const tools = useMemo(() => computeToolEfficiency(turns), [turns]);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);
  const subagent = useMemo(() => computeSubagentEfficiency(subagents, turns), [subagents, turns]);
  const recommendations = useMemo(
    () => generateRecommendations(cache, tools, context, subagent, cost),
    [cache, tools, context, subagent, cost]
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
    <div className={s.panel}>
      {/* Summary Cards */}
      <div className={s.cards}>
        <StatCard label="Total Cost" value={fmtUsd(cost.total)} sub={`${turns.length} turns`} />
        <StatCard label="Total Tokens" value={fmtTokens(totalTokens)} />
        <StatCard label="Avg / Turn" value={fmtUsd(cost.avgPerTurn)} />
        <StatCard
          label="Most Expensive Turn"
          value={`#${cost.maxTurnIdx + 1}`}
          sub={fmtUsd(cost.maxTurnCost)}
          color="var(--danger)"
        />
      </div>

      {/* Charts Row */}
      <div className={s.charts}>
        {/* Cost by Token Type (Donut) */}
        <div className={s.chartBox}>
          <div className={s.chartTitle}>Cost by Token Type</div>
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
        </div>

        {/* Tool Call Distribution */}
        <div className={s.chartBox}>
          <div className={s.chartTitle}>Tool Calls by Category</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={toolBarData} layout="vertical" margin={{top: 4, right: 12, bottom: 4, left: 50}}>
              <CartesianGrid horizontal={false} stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis type="number" tick={axisTickStyle()} />
              <YAxis type="category" dataKey="cls" tick={axisTickStyle()} width={45} />
              <Tooltip contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle()} itemStyle={tooltipItemStyle()} cursor={cursorStyle()} />
              <Bar dataKey="count" shape={<ColoredBar />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className={s.recsSection}>
          <div className={s.chartTitle}>Recommendations</div>
          <div className={s.recs}>
            {recommendations.map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
