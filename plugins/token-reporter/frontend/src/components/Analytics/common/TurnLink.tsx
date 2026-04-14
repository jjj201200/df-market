import {useSessionStore} from '../../../stores/sessionStore';
import {useChartStore} from '../../../stores/chartStore';
import {scrollToTurnIndex} from '../../../utils/scroll';
import s from './TurnLink.module.scss';

interface TurnLinkProps {
  turnId: number;
  prefix?: string;
  children?: React.ReactNode;
}

export default function TurnLink({turnId, prefix = '#', children}: TurnLinkProps) {
  const turns = useSessionStore((st) => st.turns);
  const setSelected = useChartStore((st) => st.setSelected);

  const handleClick = () => {
    const idx = turns.findIndex((t) => t.id === turnId);
    if (idx >= 0) {
      scrollToTurnIndex(turns, idx, 'top');
      setSelected(turnId);
    }
  };

  return (
    <button className={s.link} onClick={handleClick} type="button">
      {children ?? `${prefix}${turnId}`}
    </button>
  );
}
