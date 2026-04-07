import { init } from "./session.js";
import {
  startDrag,
  toggleDim,
  scrollToTurnIndex,
} from "./interactions.js";
import {
  toggleTcGroup,
  toggleTcDetail,
  toggleThink,
  toggleExp,
  toggleCmdOutput,
} from "./renderer.js";
import { drawBrushChart, drawMainChart } from "./chart.js";

// Expose functions used by inline HTML onclick/onmousedown attributes
window.startDrag = startDrag;
window.toggleDim = toggleDim;
window.scrollToTurnIndex = scrollToTurnIndex;
window.toggleTcGroup = toggleTcGroup;
window.toggleTcDetail = toggleTcDetail;
window.toggleThink = toggleThink;
window.toggleExp = toggleExp;
window.toggleCmdOutput = toggleCmdOutput;

window.addEventListener("load", init);
window.addEventListener("resize", () => {
  drawBrushChart();
  drawMainChart();
});
