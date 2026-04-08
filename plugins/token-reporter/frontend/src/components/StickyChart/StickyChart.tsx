import {useMemo, useRef, useEffect} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import DimBar from './DimBar';
import SessionBar from './SessionBar';
import MainChart from './MainChart';
import BrushChart from './BrushChart';
import BrushOverlay from './BrushOverlay';
import ChartLegend from './ChartLegend';
import LimitsDisplay from './LimitsDisplay';
import styles from './StickyChart.module.scss';

export default function StickyChart() {
  const turns = useSessionStore((s) => s.turns);
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);

  const rangeLabel = useMemo(() => {
    const N = turns.length;
    if (N === 0) return '';
    const lo = Math.round(brushL * (N - 1));
    const hi = Math.round(brushR * (N - 1));
    const first = turns[lo];
    const last = turns[hi];
    if (!first || !last) return '';
    return `Request #${first.id} \u2013 #${last.id}`;
  }, [turns, brushL, brushR]);

  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Attach native non-passive wheel listener to prevent page scroll
  // when wheeling over the chart area. React onWheel is passive by default
  // and cannot call preventDefault().
  useEffect(() => {
    const stop = (e: WheelEvent) => {
      e.preventDefault();
    };
    const el = chartAreaRef.current;
    el?.addEventListener('wheel', stop, {passive: false});
    return () => el?.removeEventListener('wheel', stop);
  }, []);

  return (
    <div id="stickyChart" className={styles.stickyChart}>
      <DimBar />
      <SessionBar />

      <div className={styles.chartHeader}>
        <span className={styles.chartTitleText}>Token Usage</span>
        {rangeLabel && <span className={styles.rangeLabel}>{rangeLabel}</span>}
      </div>

      <div ref={chartAreaRef} className={styles.chartArea}>
        <div className={styles.mainChartScroll}>
          <MainChart />
        </div>

        <div className={styles.brushWrap}>
          <BrushChart />
          <BrushOverlay />
        </div>
      </div>

      <ChartLegend />
      <LimitsDisplay />
    </div>
  );
}
