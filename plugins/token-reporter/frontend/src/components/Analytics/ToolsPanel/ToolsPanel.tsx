import {useMemo} from 'react';
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
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
import TurnLink from '../common/TurnLink';
import s from './ToolsPanel.module.scss';

export default function ToolsPanel() {
  const {t} = useI18n();
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
        <StatCard label={t('tools.totalCalls')} value={String(tools.totalCalls)} />
        <StatCard
          label={t('tools.errorRate')}
          value={pct(tools.errorRate)}
          sub={t('tools.nFailed', {count: tools.totalErrors})}
          color={tools.errorRate > 0.15 ? 'var(--danger)' : undefined}
        />
        <StatCard label={t('tools.redundantGroups')} value={String(tools.redundantGroups.length)} />
        <StatCard label={t('tools.largeReturns')} value={String(tools.largeCalls.length)} />
      </CardGrid>

      {/* Error rate by tool class */}
      {errorChartData.length > 0 && (
        <ChartBox title={t('tools.callsAndErrors')}>
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
              <Bar dataKey="total" fill={cssVar('--accent') || '#58a6ff'} radius={[0, 4, 4, 0]} name={t('tools.total')} />
              <Bar dataKey="errors" fill={cssVar('--danger') || '#f85149'} radius={[0, 4, 4, 0]} name={t('tools.errors')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      {/* Redundant tool calls */}
      {tools.redundantGroups.length > 0 && (
        <ChartBox title={t('tools.redundantCalls')}>
          <div className={s.list}>
            {tools.redundantGroups.slice(0, 10).map((g, i) => (
              <div key={i} className={s.redundantItem}>
                <span className={s.redundantCls}>{g.cls}</span>
                <span className={s.redundantKey} title={g.keyParam}>
                  {g.keyParam.length > 200 ? g.keyParam.slice(0, 200) + '...' : g.keyParam}
                </span>
                <span className={s.redundantCount}>{t('tools.timesCount', {count: g.count})}</span>
                <span className={s.redundantTurns}>
                  {t('tools.turnsLabel', {ids: ''})}
                  {g.turnIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ', '}
                      <TurnLink turnId={id} />
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </ChartBox>
      )}

      {/* Large returns */}
      {tools.largeCalls.length > 0 && (
        <ChartBox title={t('tools.largeToolReturns')}>
          <div className={s.list}>
            {tools.largeCalls.slice(0, 10).map((lc, i) => (
              <div key={i} className={s.largeItem}>
                <span className={s.largeTool}>{lc.toolName}</span>
                <span className={s.largeSize}>{lc.retSize}</span>
                <span className={s.largeTurn}><TurnLink turnId={lc.turnId} /></span>
              </div>
            ))}
          </div>
        </ChartBox>
      )}

      {/* Sidechain analysis */}
      {sidechain.sidechainTurns > 0 && (
        <ChartBox title={t('tools.sidechainCalls')}>
          <CardGrid minWidth={130}>
            <StatCard
              label={t('tools.sidechainTurns')}
              value={String(sidechain.sidechainTurns)}
              sub={t('tools.pctOfTotal', {pct: (sidechain.sidechainPct * 100).toFixed(1)})}
            />
            <StatCard
              label={t('tools.sidechainCost')}
              value={fmtUsd(sidechain.sidechainCost)}
              sub={t('tools.pctOfTotal', {pct: (sidechain.sidechainCostPct * 100).toFixed(1)})}
              color={sidechain.sidechainCostPct > 0.4 ? 'var(--warning)' : undefined}
            />
          </CardGrid>
        </ChartBox>
      )}
    </Panel>
  );
}
