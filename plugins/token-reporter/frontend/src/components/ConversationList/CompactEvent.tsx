import React from 'react';
import type {CompactItem} from '../../types/state';
import {useI18n} from '../../i18n';
import {fmt} from '../../utils/format';
import {IconBolt} from '@tabler/icons-react';

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    marginBottom: 10,
    background: 'var(--purple-3)',
    border: '1px solid var(--purple-a6)',
    borderLeft: '3px solid var(--purple-9)',
    borderRadius: 4,
    fontSize: 12,
    boxShadow: '0 0 10px var(--purple-a2)',
    position: 'relative',
  },
  bolt: {
    fontSize: 12,
    filter: 'drop-shadow(0 0 4px var(--purple-9))',
  },
  label: {
    color: 'var(--purple-9)',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.08em',
    textShadow: '0 0 6px var(--purple-a5)',
  },
  detail: {
    color: 'var(--purple-11)',
    flex: 1,
  },
  meta: {
    color: 'var(--purple-7)',
    fontSize: 12,
  },
};

interface CompactEventProps {
  item: CompactItem;
}

export const CompactEvent: React.FC<CompactEventProps> = React.memo(({item}) => {
  const {t} = useI18n();
  return (
    <div style={styles.wrap}>
      <IconBolt size={14} stroke={1.5} style={styles.bolt} />
      <span style={styles.label}>{t('compact.label')}</span>
      <span style={styles.detail}>{t('compact.description')}</span>
      <span style={styles.meta}>
        {t('compact.detail', {time: item.time, trigger: item.trigger || 'auto', tokens: fmt(item.preTokens || 0)})}
      </span>
    </div>
  );
});

CompactEvent.displayName = 'CompactEvent';
