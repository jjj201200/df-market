import {useMemo} from 'react';
import {AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
import {computeContextGrowth, computeThinkingMetrics, computePressureMetrics} from '../../../utils/analytics';
import {
  tooltipStyle,
  tooltipLabelStyle,
  tooltipItemStyle,
  cursorStyle,
  gridStroke,
  axisTickStyle,
  cssVar,
} from '../../../utils/chartTheme';
import {fmtTokens} from '../../../utils/format';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import TurnLink from '../common/TurnLink';
import {useChartTurnClick} from '../common/useChartTurnClick';
import s from './ContextPanel.module.scss';

export default function ContextPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);
  const thinking = useMemo(() => computeThinkingMetrics(turns), [turns]);
  const pressure = useMemo(() => computePressureMetrics(data, turns), [data, turns]);
  const hasThinking = thinking.turnsWithThinking > 0;

  const chartData = context.points.map((p, i) => ({
    turn: `#${p.turnId}`,
    cumulative: p.cumulative,
    delta: p.delta,
    thinkingEst: hasThinking ? Math.round((thinking.perTurn[i]?.chars ?? 0) / 4) : 0,
  }));

  const totalTokens = context.points.length > 0 ? context.points[context.points.length - 1]!.cumulative : 0;
  const onChartClick = useChartTurnClick();

  return (
    <Panel>
      <CardGrid>
        <StatCard label={t('context.cumulativeTokens')} value={fmtTokens(totalTokens)} sub={t('common.estimated')} />
        <StatCard
          label={t('context.avgGrowth')}
          value={fmtTokens(context.avgGrowthPerTurn)}
          sub={t('common.estimated')}
        />
        <StatCard
          label={t('context.compactionEvents')}
          value={String(context.compactEvents.length)}
          color={context.compactEvents.length > 2 ? 'var(--warning)' : undefined}
        />
        <StatCard label={t('pressure.peakTokens')} value={fmtTokens(pressure.peakTokens)} />
        <StatCard
          label={t('pressure.avgTurnsBetweenCompact')}
          value={Math.round(pressure.avgTurnsBetweenCompact).toString()}
          color={
            pressure.avgTurnsBetweenCompact < 10
              ? 'var(--danger)'
              : pressure.avgTurnsBetweenCompact < 15
                ? 'var(--warning)'
                : undefined
          }
        />
        <StatCard
          label={t('pressure.estimatedToLimit')}
          value={pressure.estimatedTurnsToLimit !== null ? String(pressure.estimatedTurnsToLimit) : '-'}
          color={
            pressure.estimatedTurnsToLimit !== null && pressure.estimatedTurnsToLimit < 20 ? 'var(--danger)' : undefined
          }
        />
      </CardGrid>

      <ChartBox title={t('context.contextWindowGrowth')}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{top: 20, right: 12, bottom: 4, left: 8}} onClick={onChartClick}>
            <defs>
              <linearGradient id="contextGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cssVar('--accent') || '#58a6ff'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={cssVar('--accent') || '#58a6ff'} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke()} strokeDasharray="3 3" />
            <XAxis dataKey="turn" tick={axisTickStyle()} interval="preserveStartEnd" />
            <YAxis tick={axisTickStyle()} tickFormatter={fmtTokens} width={55} />
            <Tooltip
              contentStyle={tooltipStyle()}
              labelStyle={tooltipLabelStyle()}
              itemStyle={tooltipItemStyle()}
              formatter={(value) => fmtTokens(Number(value))}
              cursor={cursorStyle()}
            />
            <ReferenceLine
              y={200_000}
              stroke={cssVar('--danger') || '#f85149'}
              strokeDasharray="4 4"
              label={{
                value: '200K limit',
                fill: cssVar('--danger') || '#f85149',
                fontSize: 10,
                position: 'right',
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={cssVar('--accent') || '#58a6ff'}
              fill="url(#contextGrad)"
              strokeWidth={2}
              name={t('context.cumulative')}
            />
            {/* Compact event markers */}
            {context.compactEvents.map((ce, i) => (
              <ReferenceLine
                key={i}
                x={`#${ce.afterTurnIdx + 1}`}
                stroke={cssVar('--danger') || '#f85149'}
                strokeDasharray="4 4"
                label={{
                  value: t('context.compactWithTokens', {tokens: fmtTokens(ce.preTokens)}),
                  fill: cssVar('--danger') || '#f85149',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartBox>

      {/* Per-turn delta */}
      <ChartBox title={t('context.tokensAddedPerTurn')}>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{top: 8, right: 12, bottom: 4, left: 8}} onClick={onChartClick}>
            <CartesianGrid stroke={gridStroke()} strokeDasharray="3 3" />
            <XAxis dataKey="turn" tick={axisTickStyle()} interval="preserveStartEnd" />
            <YAxis tick={axisTickStyle()} tickFormatter={fmtTokens} width={55} />
            <Tooltip
              contentStyle={tooltipStyle()}
              labelStyle={tooltipLabelStyle()}
              itemStyle={tooltipItemStyle()}
              formatter={(value) => fmtTokens(Number(value))}
              cursor={cursorStyle()}
            />
            <Area
              type="monotone"
              dataKey="delta"
              stroke={cssVar('--token-output') || '#3fb950'}
              fill={cssVar('--token-output') || '#3fb950'}
              fillOpacity={0.15}
              strokeWidth={1.5}
              name={t('context.delta')}
            />
            {hasThinking && (
              <Area
                type="monotone"
                dataKey="thinkingEst"
                stroke={cssVar('--token-cache-write') || '#a371f7'}
                fill={cssVar('--token-cache-write') || '#a371f7'}
                fillOpacity={0.2}
                strokeWidth={1.5}
                name={t('context.thinkingEst')}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartBox>

      {/* High spike turns */}
      {pressure.highSpikeTurns.length > 0 && (
        <ChartBox title={t('pressure.highSpikeTurns')}>
          <table className={s.spikeTable}>
            <thead>
              <tr>
                <th>{t('pressure.turn')}</th>
                <th>{t('pressure.delta')}</th>
              </tr>
            </thead>
            <tbody>
              {pressure.highSpikeTurns.map((st) => (
                <tr key={st.turnId}>
                  <td>
                    <TurnLink turnId={st.turnId} />
                  </td>
                  <td className={s.spikeDelta}>{fmtTokens(st.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartBox>
      )}
    </Panel>
  );
}
