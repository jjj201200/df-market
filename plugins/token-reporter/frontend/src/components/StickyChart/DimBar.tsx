import clsx from 'clsx';
import {useChartStore} from '../../stores/chartStore';
import {useI18n} from '../../i18n';
import type {TranslationKey} from '../../i18n';
import type {Dims} from '../../types/state';
import styles from './DimBar.module.scss';

const CHIPS: {key: keyof Dims; labelKey: TranslationKey; variant: string}[] = [
  {key: 'input', labelKey: 'common.input', variant: 'input'},
  {key: 'output', labelKey: 'common.output', variant: 'output'},
  {key: 'cacheR', labelKey: 'common.cacheRead', variant: 'cacheR'},
  {key: 'cacheC', labelKey: 'common.cacheCreate', variant: 'cacheC'},
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
          {t(chip.labelKey)}
        </span>
      ))}
    </div>
  );
}
