import {COLORS} from '../../types/state';
import {useI18n} from '../../i18n';

const ITEMS = [
  {key: 'input', labelKey: 'common.input', color: COLORS.input},
  {key: 'output', labelKey: 'common.output', color: COLORS.output},
  {key: 'cacheR', labelKey: 'common.cacheRead', color: COLORS.cacheR},
  {key: 'cacheC', labelKey: 'common.cacheCreate', color: COLORS.cacheC},
] as const;

export default function ChartLegend() {
  const {t} = useI18n();
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        marginTop: 6,
        flexWrap: 'wrap',
      }}
    >
      {ITEMS.map((item) => (
        <span
          key={item.key}
          style={{
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: item.color,
              display: 'inline-block',
            }}
          />
          {t(item.labelKey)}
        </span>
      ))}
    </div>
  );
}
