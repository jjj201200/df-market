import s from './StatCard.module.scss';

interface Props {
  label: string;
  value: string | React.ReactNode;
  sub?: string;
  color?: string;
}

export default function StatCard({label, value, sub, color}: Props) {
  return (
    <div className={s.card}>
      <div className={s.label}>{label}</div>
      <div className={s.value} style={color ? {color} : undefined}>
        {value}
      </div>
      {sub && <div className={s.sub}>{sub}</div>}
    </div>
  );
}
