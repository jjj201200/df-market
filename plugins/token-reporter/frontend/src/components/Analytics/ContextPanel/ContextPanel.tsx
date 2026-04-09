import {useMemo} from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {computeContextGrowth} from '../../../utils/analytics';
import {tooltipStyle, tooltipLabelStyle, tooltipItemStyle, cursorStyle, gridStroke, axisTickStyle, cssVar} from '../../../utils/chartTheme';
import StatCard from '../common/StatCard';
import s from './ContextPanel.module.scss';

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

export default function ContextPanel() {
  const turns = useSessionStore((st) => st.turns);
  const data = useSessionStore((st) => st.data);
  const context = useMemo(() => computeContextGrowth(data, turns), [data, turns]);

  const chartData = context.points.map((p) => ({
    turn: `#${p.turnId}`,
    cumulative: p.cumulative,
    delta: p.delta,
  }));

  const totalTokens = context.points.length > 0 ? context.points[context.points.length - 1]!.cumulative : 0;

  return (
    <div className={s.panel}>
      <div className={s.cards}>
        <StatCard label="Cumulative Tokens" value={fmtTokens(totalTokens)} />
        <StatCard label="Avg Growth / Turn" value={fmtTokens(context.avgGrowthPerTurn)} />
        <StatCard
          label="Compaction Events"
          value={String(context.compactEvents.length)}
          color={context.compactEvents.length > 2 ? 'var(--warning)' : undefined}
        />
      </div>

      <div className={s.chartBox}>
        <div className={s.chartTitle}>Context Window Growth</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{top: 8, right: 12, bottom: 4, left: 8}}>
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
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={cssVar('--accent') || '#58a6ff'}
              fill="url(#contextGrad)"
              strokeWidth={2}
              name="Cumulative"
            />
            {/* Compact event markers */}
            {context.compactEvents.map((ce, i) => (
              <ReferenceLine
                key={i}
                x={`#${ce.afterTurnIdx + 1}`}
                stroke={cssVar('--danger') || '#f85149'}
                strokeDasharray="4 4"
                label={{
                  value: `compact (${fmtTokens(ce.preTokens)})`,
                  fill: cssVar('--danger') || '#f85149',
                  fontSize: 10,
                  position: 'top',
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-turn delta */}
      <div className={s.chartBox}>
        <div className={s.chartTitle}>Tokens Added per Turn</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{top: 8, right: 12, bottom: 4, left: 8}}>
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
              name="Delta"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
