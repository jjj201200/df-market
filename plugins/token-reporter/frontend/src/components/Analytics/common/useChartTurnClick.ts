import {useCallback} from 'react';
import type {MouseHandlerDataParam} from 'recharts/types/synchronisation/types';
import {useChartStore} from '../../../stores/chartStore';
import {scrollToTurnById} from '../../../utils/scroll';

export function useChartTurnClick() {
  const setSelected = useChartStore((st) => st.setSelected);

  const handleClick = useCallback(
    (state: MouseHandlerDataParam) => {
      const label = state.activeLabel;
      if (label == null) return;
      const turnId = parseInt(String(label).replace(/^#/, ''), 10);
      if (Number.isNaN(turnId)) return;
      scrollToTurnById(turnId);
      setSelected(turnId);
    },
    [setSelected],
  );

  return handleClick;
}
