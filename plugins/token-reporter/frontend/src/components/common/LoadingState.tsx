import React from 'react';
import clsx from 'clsx';
import s from './LoadingState.module.scss';

export const LoadingState: React.FC = () => (
  <div className={s.initState}>
    <div className={s.loadStatus}>
      <span className={s.spinner} />
      Loading session data...
    </div>
    {Array.from({length: 5}, (_, i) => (
      <div className={s.skRow} key={i}>
        <div className={s.skBadge} />
        <div className={clsx(s.skLine, i % 2 === 0 ? s.m : s.s)} />
      </div>
    ))}
  </div>
);
