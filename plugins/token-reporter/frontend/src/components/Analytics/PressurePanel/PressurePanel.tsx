import {useMemo} from 'react';
import {AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
import {computePressureMetrics, computeContextGrowth} from '../../../utils/analytics';
import {tooltipStyle, tooltipLabelStyle, tooltipItemStyle, cursorStyle, gridStroke, axisTickStyle, cssVar} from '../../../utils/chartTheme';
import {fmtTokens} from '../../../utils/format';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';
import s from './PressurePanel.module.scss';

export default function PressurePanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const pressure = useMemo(() => computePressureMetrics(data, turns), [data, turns]);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);

  const chartData = context.points.map((p) => ({
    turn: `#${p.turnId}`,
    cumulative: p.cumulative,
    delta: p.delta,
  }));

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label={t('pressure.peakTokens')} value={fmtTokens(pressure.peakTokens)} />
        <StatCard label={t('pressure.peakTurn')} value={`#${pressure.peakTurnId}`} />
        <StatCard
          label={t('pressure.compactionCount')}
          value={String(pressure.compactionCount)}
          color={pressure.compactionCount > 2 ? 'var(--warning)' : undefined}
        />
        <StatCard
          label={t('pressure.avgTurnsBetweenCompact')}
          value={Math.round(pressure.avgTurnsBetweenCompact).toString()}
          color={pressure.avgTurnsBetweenCompact < 10 ? 'var(--danger)' : pressure.avgTurnsBetweenCompact < 15 ? 'var(--warning)' : undefined}
        />
        <StatCard label={t('pressure.growthRate')} value={fmtTokens(Math.round(pressure.growthRatePer10Turns))} />
        <StatCard
          label={t('pressure.estimatedToLimit')}
          value={pressure.estimatedTurnsToLimit !== null ? String(pressure.estimatedTurnsToLimit) : '-'}
          color={pressure.estimatedTurnsToLimit !== null && pressure.estimatedTurnsToLimit < 20 ? 'var(--danger)' : undefined}
        />
      </CardGrid>

      {/* Context growth trend with 200K limit line */}
      {chartData.length > 0 && (
        <ChartBox title={t('pressure.trend')}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{top: 8, right: 12, bottom: 4, left: 8}}>
              <defs>
                <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#pressureGrad)"
                strokeWidth={2}
                name={t('context.cumulative')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

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
                  <td>#{st.turnId}</td>
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
