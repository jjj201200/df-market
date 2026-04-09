import clsx from 'clsx';
import type {Recommendation} from '../../../utils/analytics';
import {useI18n} from '../../../i18n';
import s from './RecommendationCard.module.scss';

const SEVERITY_ICON: Record<string, string> = {
  high: '\u26a0',
  medium: '\u25cf',
  low: '\u2713',
};

export default function RecommendationCard({rec}: {rec: Recommendation}) {
  const {t} = useI18n();
  return (
    <div className={clsx(s.card, s[rec.severity])}>
      <div className={s.header}>
        <span className={s.icon}>{SEVERITY_ICON[rec.severity]}</span>
        <span className={s.title}>{rec.title}</span>
        <span className={s.badge}>{rec.category}</span>
      </div>
      <div className={s.detail}>{rec.detail}</div>
      {rec.estimatedSavings && <div className={s.savings}>{t('rec.potentialSavings', {amount: rec.estimatedSavings})}</div>}
    </div>
  );
}
