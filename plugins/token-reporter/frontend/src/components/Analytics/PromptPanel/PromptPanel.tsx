import {useMemo} from 'react';
import {AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine} from 'recharts';
import {useSessionStore} from '../../../stores/sessionStore';
import {useI18n} from '../../../i18n';
import {computePromptMetrics} from '../../../utils/analytics';
import {fmtTokens, fmtPct} from '../../../utils/format';
import {tooltipStyle, tooltipLabelStyle, tooltipItemStyle, cursorStyle, gridStroke, axisTickStyle, cssVar} from '../../../utils/chartTheme';
import Panel from '../common/Panel';
import CardGrid from '../common/CardGrid';
import ChartBox from '../common/ChartBox';
import StatCard from '../common/StatCard';

export default function PromptPanel() {
  const {t} = useI18n();
  const turns = useSessionStore((st) => st.turns);
  const prompt = useMemo(() => computePromptMetrics(turns), [turns]);

  const chartData = prompt.promptTrend.map((p) => ({
    turn: `#${p.turnId}`,
    chars: p.chars,
    tokens: p.tokens,
    ratio: p.ratio,
  }));

  const ratioData = prompt.promptTrend.map((p) => ({
    turn: `#${p.turnId}`,
    ratio: p.ratio,
  }));

  return (
    <Panel>
      <CardGrid minWidth={130}>
        <StatCard label={t('prompt.avgLength')} value={`${Math.round(prompt.avgUserLength)}`} />
        <StatCard label={t('prompt.avgTokens')} value={fmtTokens(Math.round(prompt.avgUserTokens))} />
        <StatCard
          label={t('prompt.ioRatio')}
          value={fmtPct(prompt.inputOutputRatio)}
          color={prompt.inputOutputRatio < 0.1 ? 'var(--warning)' : undefined}
        />
        <StatCard
          label={t('prompt.shortStreak')}
          value={String(prompt.shortPromptStreak)}
          color={prompt.shortPromptStreak >= 3 ? 'var(--warning)' : undefined}
        />
        <StatCard
          label={t('prompt.longestInput')}
          value={`#${prompt.longestPromptTurn}`}
          sub={`${prompt.longestPromptChars} chars`}
        />
      </CardGrid>

      {/* Input length trend */}
      {chartData.length > 0 && (
        <ChartBox title={t('prompt.trend')}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{top: 8, right: 12, bottom: 4, left: 8}}>
              <defs>
                <linearGradient id="promptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssVar('--accent') || '#58a6ff'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={cssVar('--accent') || '#58a6ff'} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis dataKey="turn" tick={axisTickStyle()} interval="preserveStartEnd" />
              <YAxis tick={axisTickStyle()} width={55} />
              <Tooltip
                contentStyle={tooltipStyle()}
                labelStyle={tooltipLabelStyle()}
                itemStyle={tooltipItemStyle()}
                cursor={cursorStyle()}
              />
              <Area
                type="monotone"
                dataKey="chars"
                stroke={cssVar('--accent') || '#58a6ff'}
                fill="url(#promptGrad)"
                strokeWidth={1.5}
                name={t('prompt.chars')}
              />
              <ReferenceLine
                y={2000}
                stroke={cssVar('--warning') || '#d29922'}
                strokeDasharray="4 4"
                label={{
                  value: '2000 chars',
                  fill: cssVar('--warning') || '#d29922',
                  fontSize: 10,
                  position: 'right',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      {/* Input/output ratio per turn */}
      {ratioData.length > 0 && (
        <ChartBox title={t('prompt.ratio')}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ratioData} margin={{top: 8, right: 12, bottom: 4, left: 8}}>
              <CartesianGrid stroke={gridStroke()} strokeDasharray="3 3" />
              <XAxis dataKey="turn" tick={axisTickStyle()} interval="preserveStartEnd" />
              <YAxis tick={axisTickStyle()} width={45} />
              <Tooltip
                contentStyle={tooltipStyle()}
                labelStyle={tooltipLabelStyle()}
                itemStyle={tooltipItemStyle()}
                formatter={(value) => Number(value).toFixed(2)}
                cursor={cursorStyle()}
              />
              <Area
                type="monotone"
                dataKey="ratio"
                stroke={cssVar('--token-output') || '#3fb950'}
                fill={cssVar('--token-output') || '#3fb950'}
                fillOpacity={0.15}
                strokeWidth={1.5}
                name={t('prompt.ratio')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      )}
    </Panel>
  );
}
