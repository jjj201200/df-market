import {useI18n} from '../../../i18n';
import type {TranslationKey} from '../../../i18n/types';
import type {CompositionResponse, CompositionSources} from '../../../types/api';
import {fmtTokens} from '../../../utils/format';
import CardGrid from '../common/CardGrid';
import StatCard from '../common/StatCard';

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

interface Props {
  composition: CompositionResponse | null;
}

/** One card per source for the latest turn, showing tokens / delta / %. */
export default function SourceCards({composition}: Props) {
  const {t} = useI18n();
  if (!composition || composition.points.length === 0) return null;
  const last = composition.points[composition.points.length - 1]!;
  const prev = composition.points.length > 1 ? composition.points[composition.points.length - 2]! : null;
  const unknown = new Set<string>(composition.unknownSources ?? []);

  return (
    <CardGrid>
      {ORDER.map((k) => {
        if (unknown.has(k)) {
          return (
            <StatCard
              key={k}
              label={t(LABEL_KEY[k])}
              value={t('composition.unknownPlaceholder')}
              sub={t('composition.enableAuditHint')}
            />
          );
        }
        const cur = last.sources[k];
        const prevVal = prev?.sources[k] ?? cur;
        const delta = cur - prevVal;
        const pct = last.total > 0 ? Math.round((cur / last.total) * 100) : 0;
        const deltaPct = prevVal > 0 ? Math.abs(delta) / prevVal : 0;
        const color = deltaPct > 0.1 ? 'var(--warning)' : undefined;
        const sign = delta >= 0 ? '+' : '';
        const sub = `${t('composition.pctLabel', {pct})} · ${t('composition.deltaLabel', {delta: `${sign}${fmtTokens(delta)}`})}`;
        return (
          <StatCard
            key={k}
            label={t(LABEL_KEY[k])}
            value={fmtTokens(cur)}
            sub={sub}
            color={color}
          />
        );
      })}
    </CardGrid>
  );
}
