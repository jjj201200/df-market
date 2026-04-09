import type {ReactNode} from 'react';
import s from './ChartGrid.module.scss';

export default function ChartGrid({children}: {children: ReactNode}) {
  return <div className={s.grid}>{children}</div>;
}
