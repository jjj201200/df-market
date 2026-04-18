import clsx from 'clsx';
import s from './StatCard.module.scss';

interface Props {
  label: string;
  value: string | React.ReactNode;
  sub?: string;
  color?: string;
  /** 让卡片占 grid 中 2 列——用于内容较长的场景(如含斜杠分隔的组合值) */
  wide?: boolean;
}

export default function StatCard({label, value, sub, color, wide}: Props) {
  return (
    <div className={clsx(s.card, wide && s.wide)}>
      <div className={s.label}>{label}</div>
      <div className={s.value} style={color ? {color} : undefined}>
        {value}
      </div>
      {sub && <div className={s.sub}>{sub}</div>}
    </div>
  );
}
