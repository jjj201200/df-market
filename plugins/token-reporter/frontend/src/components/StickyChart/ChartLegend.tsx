import {COLORS} from '../../types/state';

const ITEMS = [
  {key: 'input', label: 'Input', color: COLORS.input},
  {key: 'output', label: 'Output', color: COLORS.output},
  {key: 'cacheR', label: 'Cache Read', color: COLORS.cacheR},
  {key: 'cacheC', label: 'Cache Create', color: COLORS.cacheC},
] as const;

export default function ChartLegend() {
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
          {item.label}
        </span>
      ))}
    </div>
  );
}
