import type {ReactNode} from 'react';
import s from './ChartBox.module.scss';

export default function ChartBox({title, children}: {title: string; children: ReactNode}) {
  return (
    <div className={s.box}>
      <div className={s.title}>{title}</div>
      {children}
    </div>
  );
}
