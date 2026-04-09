import clsx from 'clsx';
import {useChartStore} from '../../stores/chartStore';
import type {Dims} from '../../types/state';
import styles from './DimBar.module.scss';

const CHIPS: {key: keyof Dims; label: string; variant: string}[] = [
  {key: 'input', label: 'Input', variant: 'input'},
  {key: 'output', label: 'Output', variant: 'output'},
  {key: 'cacheR', label: 'Cache Read', variant: 'cacheR'},
  {key: 'cacheC', label: 'Cache Create', variant: 'cacheC'},
];

export default function DimBar() {
  const dims = useChartStore((s) => s.dims);
  const toggleDim = useChartStore((s) => s.toggleDim);

  return (
    <div className={styles.dimBar}>
      <span className={styles.toggleTip}>TOGGEL SHOW</span>
      {CHIPS.map((chip) => (
        <span
          key={chip.key}
          className={clsx(styles.dimChip, styles[chip.variant], !dims[chip.key] && styles.off)}
          onClick={() => toggleDim(chip.key)}
        >
          <span className={styles.dot} />
          {chip.label}
        </span>
      ))}
    </div>
  );
}
