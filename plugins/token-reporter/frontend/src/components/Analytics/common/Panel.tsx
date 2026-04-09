import type {ReactNode} from 'react';
import s from './Panel.module.scss';

export default function Panel({children}: {children: ReactNode}) {
  return <div className={s.panel}>{children}</div>;
}
