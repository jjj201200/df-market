import {useRef, useCallback} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import {scrollToTurnIndex} from './MainChart';
import {suppressScrollSync} from '../../hooks/useScrollSync';
import styles from './BrushOverlay.module.scss';

export default function BrushOverlay() {
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);
  const setBrush = useChartStore((s) => s.setBrush);
  const turns = useSessionStore((s) => s.turns);

  const overlayRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent, type: 'L' | 'R' | 'M') => {
      e.preventDefault();
      e.stopPropagation();
      suppressScrollSync(2000);

      const startX = e.clientX;
      const startL = brushL;
      const startR = brushR;
      const N = turns.length;

      const getOverlayWidth = (): number => {
        const parent = overlayRef.current?.parentElement;
        if (!parent) return 400;
        // BrushChart canvas sibling width
        const canvas = parent.querySelector('canvas');
        return canvas ? canvas.clientWidth : parent.clientWidth - 2;
      };

      const onMove = (ev: MouseEvent) => {
        suppressScrollSync(2000);
        const W = getOverlayWidth();
        const dx = (ev.clientX - startX) / W;
        const minS = 1 / Math.max(N, 1);

        if (type === 'L') {
          const newL = Math.max(0, Math.min(startL + dx, startR - minS));
          setBrush(newL, startR);
        } else if (type === 'R') {
          const newR = Math.min(1, Math.max(startR + dx, startL + minS));
          setBrush(startL, newR);
        } else {
          const sp = startR - startL;
          const newL = Math.max(0, Math.min(startL + dx, 1 - sp));
          setBrush(newL, newL + sp);
        }

        const currentL = useChartStore.getState().brushL;
        scrollToTurnIndex(turns, Math.round(currentL * (N - 1)));
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [brushL, brushR, setBrush, turns],
  );

  // Compute pixel positions. The overlay width matches the brush canvas.
  // We use percentage-based positioning so it works without knowing the exact width.
  const lPct = brushL * 100;
  const rPct = brushR * 100;
  const selWidth = rPct - lPct;

  return (
    <div ref={overlayRef} className={styles.brushOverlay} style={{width: '100%'}}>
      {/* Selection highlight */}
      <div className={styles.brushSelection} style={{left: `${lPct}%`, width: `${selWidth}%`}} />
      {/* Left handle */}
      <div className={styles.brushHandle} style={{left: `${lPct}%`}} onMouseDown={(e) => startDrag(e, 'L')} />
      {/* Right handle */}
      <div className={styles.brushHandle} style={{left: `${rPct}%`}} onMouseDown={(e) => startDrag(e, 'R')} />
      {/* Move area */}
      <div
        className={styles.brushMoveArea}
        style={{left: `${lPct}%`, width: `${selWidth}%`}}
        onMouseDown={(e) => startDrag(e, 'M')}
      />
    </div>
  );
}
