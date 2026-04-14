import {useCallback} from 'react';
import type {MouseHandlerDataParam} from 'recharts/types/synchronisation/types';
import {useSessionStore} from '../../../stores/sessionStore';
import {useChartStore} from '../../../stores/chartStore';
import {scrollToTurnIndex} from '../../../utils/scroll';

export function useChartTurnClick() {
  const turns = useSessionStore((st) => st.turns);
  const setSelected = useChartStore((st) => st.setSelected);

  const handleClick = useCallback(
    (state: MouseHandlerDataParam) => {
      const label = state.activeLabel;
      if (label == null) return;
      const turnId = parseInt(String(label).replace(/^#/, ''), 10);
      if (Number.isNaN(turnId)) return;
      const idx = turns.findIndex((t) => t.id === turnId);
      if (idx >= 0) {
        scrollToTurnIndex(turns, idx, 'top');
        setSelected(turnId);
      }
    },
    [turns, setSelected]
  );

  return handleClick;
}
