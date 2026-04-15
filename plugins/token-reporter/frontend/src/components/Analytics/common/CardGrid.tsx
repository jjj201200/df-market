import type {ReactNode, CSSProperties} from 'react';
import s from './CardGrid.module.scss';

interface Props {
  children: ReactNode;
  minWidth?: number;
}

export default function CardGrid({children, minWidth}: Props) {
  const style = minWidth ? ({'--card-min': `${minWidth}px`} as CSSProperties) : undefined;
  return (
    <div className={s.grid} style={style}>
      {children}
    </div>
  );
}
