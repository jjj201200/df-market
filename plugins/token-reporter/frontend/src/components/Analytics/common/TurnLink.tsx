import {useChartStore} from '../../../stores/chartStore';
import {scrollToTurnById} from '../../../utils/scroll';
import s from './TurnLink.module.scss';

interface TurnLinkProps {
  turnId: number;
  prefix?: string;
  children?: React.ReactNode;
}

export default function TurnLink({turnId, prefix = '#', children}: TurnLinkProps) {
  const setSelected = useChartStore((st) => st.setSelected);

  const handleClick = () => {
    scrollToTurnById(turnId);
    setSelected(turnId);
  };

  return (
    <button className={s.link} onClick={handleClick} type="button">
      {children ?? `${prefix}${turnId}`}
    </button>
  );
}
