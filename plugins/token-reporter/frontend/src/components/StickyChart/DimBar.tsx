import clsx from 'clsx';
import {useChartStore} from '../../stores/chartStore';
import {useI18n} from '../../i18n';
import type {TranslationKey} from '../../i18n';
import type {Dims} from '../../types/state';
import styles from './DimBar.module.scss';

const CHIPS: {key: keyof Dims; labelKey: TranslationKey; shortKey: TranslationKey; variant: string}[] = [
  {key: 'input', labelKey: 'common.input', shortKey: 'common.inputShort', variant: 'input'},
  {key: 'output', labelKey: 'common.output', shortKey: 'common.outputShort', variant: 'output'},
  {key: 'cacheR', labelKey: 'common.cacheRead', shortKey: 'common.cacheReadShort', variant: 'cacheR'},
  {key: 'cacheC', labelKey: 'common.cacheCreate', shortKey: 'common.cacheCreateShort', variant: 'cacheC'},
];

export default function DimBar() {
  const {t} = useI18n();
  const dims = useChartStore((s) => s.dims);
  const toggleDim = useChartStore((s) => s.toggleDim);

  return (
    <div className={styles.dimBar}>
      <span className={styles.toggleTip}>{t('dim.toggleShow')}</span>
      {CHIPS.map((chip) => (
        <span
          key={chip.key}
          className={clsx(styles.dimChip, styles[chip.variant], !dims[chip.key] && styles.off)}
          onClick={() => toggleDim(chip.key)}
        >
          <span className={styles.dot} />
          <span className={styles.fullLabel}>{t(chip.labelKey)}</span>
          <span className={styles.shortLabel}>{t(chip.shortKey)}</span>
        </span>
      ))}
    </div>
  );
}
