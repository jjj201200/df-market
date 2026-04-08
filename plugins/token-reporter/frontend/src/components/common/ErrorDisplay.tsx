import React from 'react';
import s from './LoadingState.module.scss';

interface ErrorDisplayProps {
  message: string;
  detail?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({message, detail}) => (
  <div className={s.loadError}>
    <div className={s.errTitle}>{message}</div>
    {detail && <pre style={{textAlign: 'left', fontSize: 11, color: 'var(--muted)', marginTop: 8}}>{detail}</pre>}
  </div>
);
