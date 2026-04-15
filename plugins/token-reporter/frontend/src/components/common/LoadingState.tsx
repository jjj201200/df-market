import React from 'react';
import clsx from 'clsx';
import {useI18n} from '../../i18n';
import s from './LoadingState.module.scss';

export const LoadingState: React.FC = () => {
  const {t} = useI18n();
  return (
    <div className={s.initState}>
      <div className={s.loadStatus}>
        <span className={s.spinner} />
        {t('common.loading')}
      </div>
      {Array.from({length: 5}, (_, i) => (
        <div className={s.skRow} key={i}>
          <div className={s.skBadge} />
          <div className={clsx(s.skLine, i % 2 === 0 ? s.m : s.s)} />
        </div>
      ))}
    </div>
  );
};
