import {AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend} from 'recharts';
import {useI18n} from '../../../i18n';
import type {TranslationKey} from '../../../i18n/types';
import type {CompositionResponse, CompositionSources} from '../../../types/api';
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
import ChartBox from '../common/ChartBox';
import {useChartTurnClick} from '../common/useChartTurnClick';
import s from './CompositionStack.module.scss';

const ORDER: Array<keyof CompositionSources> = [
  'system_prompt',
  'tools_schema',
  'messages_user',
  'messages_assistant',
  'messages_tool_use',
  'messages_tool_result',
  'messages_thinking',
];

const LABEL_KEY: Record<keyof CompositionSources, TranslationKey> = {
  system_prompt: 'composition.sources.systemPrompt',
  tools_schema: 'composition.sources.toolsSchema',
  messages_user: 'composition.sources.user',
  messages_assistant: 'composition.sources.assistant',
  messages_tool_use: 'composition.sources.toolUse',
  messages_tool_result: 'composition.sources.toolResult',
  messages_thinking: 'composition.sources.thinking',
};

/** Colors drawn from the project's existing palette. Resolved lazily at render. */
function colorFor(k: keyof CompositionSources): string {
  switch (k) {
    case 'system_prompt': return cssVar('--accent') || '#58a6ff';
    case 'tools_schema': return cssVar('--tool-read') || '#22a2ff';
    case 'messages_user': return cssVar('--token-input') || '#0969da';
    case 'messages_assistant': return cssVar('--token-output') || '#3fb950';
    case 'messages_tool_use': return cssVar('--tool-edit') || '#f59e0b';
    case 'messages_tool_result': return cssVar('--warning') || '#eab308';
    case 'messages_thinking': return cssVar('--token-cache-write') || '#a371f7';
  }
}

interface Props {
  composition: CompositionResponse | null;
}

export default function CompositionStack({composition}: Props) {
  const {t} = useI18n();
  const onChartClick = useChartTurnClick();

  if (!composition || composition.points.length === 0) return null;
  const unknown = new Set<string>(composition.unknownSources ?? []);

  const chartData = composition.points.map((p) => {
    const row: Record<string, number | string> = {turn: `#${p.turnId}`};
    for (const k of ORDER) row[k] = p.sources[k] || 0;
    return row;
  });

  const badge = (() => {
    if (composition.source === 'live') {
      return <span className={`${s.pill} ${s.live}`}>{t('composition.live')}</span>;
    }
    if (composition.hookStale) {
      return (
        <span className={`${s.pill} ${s.stale}`} title={t('composition.hookStaleHint')}>
          {t('composition.hookStale')}
        </span>
      );
    }
    return (
      <span className={`${s.pill} ${s.estimated}`} title={t('composition.enableAuditHint')}>
        {t('composition.estimated')}
      </span>
    );
  })();

  return (
    <ChartBox title={<span className={s.title}>{t('composition.title')} {badge}</span>}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{top: 20, right: 12, bottom: 4, left: 8}} onClick={onChartClick}>
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
          <Legend wrapperStyle={{fontSize: 11}} />
          {ORDER.map((k) => {
            const isUnknown = unknown.has(k);
            const color = colorFor(k);
            return (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stackId="1"
                stroke={color}
                fill={color}
                fillOpacity={isUnknown ? 0.08 : 0.55}
                strokeDasharray={isUnknown ? '4 4' : undefined}
                strokeWidth={isUnknown ? 1 : 1.5}
                name={t(LABEL_KEY[k])}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
