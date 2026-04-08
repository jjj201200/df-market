import React from 'react';
import type {CompactItem} from '../../types/state';
import {fmt} from '../../utils/format';

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    marginBottom: 10,
    background: '#1e0f2e',
    border: '1px solid #bc8cff55',
    borderLeft: '3px solid var(--purple)',
    borderRadius: 4,
    fontSize: 12,
    boxShadow: '0 0 10px #bc8cff18',
    position: 'relative',
  },
  bolt: {
    fontSize: 12,
    filter: 'drop-shadow(0 0 4px var(--purple))',
  },
  label: {
    color: 'var(--purple)',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.08em',
    textShadow: '0 0 6px #bc8cff88',
  },
  detail: {
    color: '#d2b8ff',
    flex: 1,
  },
  meta: {
    color: '#9070bf',
    fontSize: 12,
  },
};

interface CompactEventProps {
  item: CompactItem;
}

export const CompactEvent: React.FC<CompactEventProps> = React.memo(({item}) => (
  <div style={styles.wrap}>
    <span style={styles.bolt}>&#9889;</span>
    <span style={styles.label}>COMPACT</span>
    <span style={styles.detail}>Context window compressed</span>
    <span style={styles.meta}>
      {item.time} &middot; {item.trigger || 'auto'} &middot; {fmt(item.preTokens || 0)} tokens before
    </span>
  </div>
));

CompactEvent.displayName = 'CompactEvent';
