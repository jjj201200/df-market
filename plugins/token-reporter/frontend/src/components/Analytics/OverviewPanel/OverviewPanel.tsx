import {useMemo} from 'react';
import {PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
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
  computeMcpMetrics,
  computePromptMetrics,
  computePressureMetrics,
  computeFileMetrics,
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
import TurnLink from '../common/TurnLink';
import s from './OverviewPanel.module.scss';

export default function OverviewPanel() {
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const subagents = useSessionStore((st) => st.subagents);
  const stopReasons = useSessionStore((st) => st.stopReasons);
  const cacheTtl = useSessionStore((st) => st.cacheTtl);

  const cost = useMemo(() => computeSessionCost(turns), [turns]);
  const cache = useMemo(() => computeCacheMetrics(turns), [turns]);
  const tools = useMemo(() => computeToolEfficiency(turns), [turns]);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);
  const subagent = useMemo(() => computeSubagentEfficiency(subagents, turns), [subagents, turns]);
  const modelBreakdown = useMemo(() => computeModelBreakdown(turns), [turns]);
  const thinking = useMemo(() => computeThinkingMetrics(turns, modelBreakdown.dominantModelId), [turns, modelBreakdown.dominantModelId]);
  const sidechain = useMemo(() => computeSidechainMetrics(turns), [turns]);
  const timing = useMemo(() => computeTimingMetrics(turns, cost.total), [turns, cost.total]);
  const mcp = useMemo(() => computeMcpMetrics(turns), [turns]);
  const prompt = useMemo(() => computePromptMetrics(turns), [turns]);
  const pressure = useMemo(() => computePressureMetrics(data, turns), [data, turns]);
  const files = useMemo(() => computeFileMetrics(turns), [turns]);
  const {t} = useI18n();

  const recommendations = useMemo(
    () => generateRecommendations({cache, tools, context, subagent, cost, modelBreakdown, thinking, sidechain, timing, mcp, prompt, pressure, files}, t),
    [cache, tools, context, subagent, cost, modelBreakdown, thinking, sidechain, timing, mcp, prompt, pressure, files, t]
  );
  const tc = tokenColors();

  // Recharts reads `fill` from data entries for Pie
  const pieData = [
    {name: t('common.input'), value: cost.byType.input, fill: tc.input},
    {name: t('common.output'), value: cost.byType.output, fill: tc.output},
    {name: t('common.cacheRead'), value: cost.byType.cacheRead, fill: tc.cacheRead},
    {name: t('common.cacheCreate'), value: cost.byType.cacheCreation, fill: tc.cacheCreation},
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
        <StatCard label={t('overview.totalCost')} value={fmtUsd(cost.total)} sub={t('overview.nTurns', {count: turns.length})} />
        <StatCard label={t('overview.totalTokens')} value={fmtTokens(totalTokens)} />
        <StatCard label={t('overview.avgPerTurn')} value={fmtUsd(cost.avgPerTurn)} />
        <StatCard
          label={t('overview.mostExpensiveTurn')}
          value={<TurnLink turnId={cost.maxTurnIdx + 1} />}
          sub={fmtUsd(cost.maxTurnCost)}
          color="var(--danger)"
        />
        {thinking.turnsWithThinking > 0 && (
          <StatCard
            label={t('overview.thinkingTurns')}
            value={`${thinking.turnsWithThinking}/${thinking.turnsTotal}`}
            sub={fmtPct(thinking.thinkingPct)}
          />
        )}
        {thinking.estimatedThinkingCost > 0 && (
          <StatCard
            label={t('overview.estThinkingCost')}
            value={fmtUsd(thinking.estimatedThinkingCost)}
            sub={t('overview.tokensEstimate', {tokens: fmtTokens(thinking.estimatedThinkingTokens)})}
            color={cost.total > 0 && thinking.estimatedThinkingCost / cost.total > 0.3 ? 'var(--danger)' : undefined}
          />
        )}
        {Object.keys(stopReasons).length > 0 && (
          <StatCard
            label={t('overview.stopReasons')}
            value={Object.entries(stopReasons)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')}
            sub={t('overview.stopReasonsSub')}
          />
        )}
        {(cacheTtl.ephemeral1h > 0 || cacheTtl.ephemeral5m > 0) && (
          <StatCard
            label={t('overview.cacheTtl')}
            value={`1h: ${fmtTokens(cacheTtl.ephemeral1h)} / 5m: ${fmtTokens(cacheTtl.ephemeral5m)}`}
            sub={t('overview.cacheTtlSub')}
          />
        )}
      </CardGrid>

      {/* Charts Row */}
      <ChartGrid>
        {/* Cost by Token Type (Donut) */}
        <ChartBox title={t('overview.costByTokenType')}>
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
        <ChartBox title={t('overview.toolCallsByCategory')}>
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
          <ChartBox title={t('overview.costByModel')}>
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
          <ChartBox title={t('overview.modelDetails')}>
            <table className={s.modelTable}>
              <thead>
                <tr>
                  <th>{t('overview.model')}</th>
                  <th>{t('overview.turns')}</th>
                  <th>{t('overview.tokens')}</th>
                  <th>{t('overview.cost')}</th>
                  <th>{t('overview.costPerTurn')}</th>
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
                {t('overview.modelSwitches', {count: modelBreakdown.modelSwitches})}
              </div>
            )}
          </ChartBox>
        </ChartGrid>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className={s.recsSection}>
          <div className={s.recsTitle}>{t('overview.recommendations')}</div>
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
