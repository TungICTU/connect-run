// ---------- firing / simulation ----------
function cellPercent(r,c){ return { left:((c+0.5)/state.cols)*100, top:((r+0.5)/state.rows)*100 }; }

function computeScoreTooltipScale(currentTotal, initialTotal, targetTotal){
  const start = Number.isFinite(initialTotal) && initialTotal > 0 ? initialTotal : 50;
  const target = Number.isFinite(targetTotal) && targetTotal > start ? targetTotal : start + 1;
  const progress = Math.max(0, (currentTotal - start) / (target - start));
  const steps = Math.floor(progress * 10 + 1e-9);
  return Math.min(4, 1 + steps * 0.05);
}

function getScoreDisplayFontSize(scale=1){
  const safeScale = Number.isFinite(scale) ? scale : 1;
  return SCORE_DISPLAY_BASE_FONT_SIZE * safeScale;
}

function animateScoreTipValue(valueEl, nextTotal, previousTotal, initialTotal, targetTotal, tip){
  if(!valueEl) return;
  const prevTotal = Number.isFinite(previousTotal) ? previousTotal : nextTotal;
  const nextScale = computeScoreTooltipScale(nextTotal, initialTotal, targetTotal);
  const previousScale = Number.isFinite(valueEl._scoreScale) ? valueEl._scoreScale : 1;
  const crossedGrowthStep = nextScale > previousScale;

  if(valueEl._scoreAnim){ try{ valueEl._scoreAnim.cancel(); }catch{} valueEl._scoreAnim=null; }
  valueEl._scoreScale = nextScale;
  if(tip) tip.style.setProperty('--score-font-size', `${getScoreDisplayFontSize(nextScale)}px`);

  if(nextTotal <= prevTotal){
    valueEl.style.transform='scale(1)';
    return;
  }

  const duration=(crossedGrowthStep ? 420 : 280) / animationSpeed;
  const keyframes=crossedGrowthStep
    ? [
        {transform:'scale(1)'},
        {transform:'scale(1.16) translate3d(-2px,-1px,0) rotate(-4deg)',offset:.22},
        {transform:'scale(.96) translate3d(2px,1px,0) rotate(3.5deg)',offset:.48},
        {transform:'scale(1.04) translate3d(-1px,0,0) rotate(-1.5deg)',offset:.74},
        {transform:'scale(1) translate3d(0,0,0) rotate(0deg)',offset:1}
      ]
    : [
        {transform:'scale(1) translate3d(0,0,0) rotate(0deg)'},
        {transform:'scale(1) translate3d(-3px,-1px,0) rotate(-6deg)',offset:.14},
        {transform:'scale(1) translate3d(3px,1px,0) rotate(6deg)',offset:.28},
        {transform:'scale(1) translate3d(-2.5px,0,0) rotate(-4.5deg)',offset:.42},
        {transform:'scale(1) translate3d(2.5px,0,0) rotate(4.5deg)',offset:.56},
        {transform:'scale(1) translate3d(-1.5px,0,0) rotate(-2.5deg)',offset:.70},
        {transform:'scale(1) translate3d(1.5px,0,0) rotate(2.5deg)',offset:.84},
        {transform:'scale(1) translate3d(0,0,0) rotate(0deg)',offset:1}
      ];

  valueEl._scoreAnim=valueEl.animate(keyframes,{duration,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards',composite:'replace'});
  valueEl._scoreAnim.onfinish=()=>{ valueEl.style.transform='scale(1)'; valueEl._scoreAnim=null; };
}

function createBallEntity(r,c,ballState,animateScore=false,previousTotal=null){
  const ball = document.createElement('div'); ball.className='ball';
  if(ballState.prop){ ball.dataset.prop=ballState.prop; ball.style.setProperty('--prop-color', PROP_COLOR[ballState.prop]); }
  if(ballState.enh) ball.dataset.enh = ballState.enh;
  const p = cellPercent(r,c);
  ball.style.left=p.left+'%'; ball.style.top=p.top+'%';
  boardWrapEl.appendChild(ball);

  const tip = document.createElement('div'); tip.className='ball-tooltip';
  tip.style.left=p.left+'%'; tip.style.top=p.top+'%';
  const tipValue = document.createElement('span');
  tipValue.className='ball-tooltip-value';
  const currentTotal = Math.round(ballState.total);
  tipValue.textContent = formatNumber(currentTotal);
  tipValue._initialTotal = ballState.initialTotal;
  tipValue._scoreScale = 1;
  tipValue._lastTotal = Number.isFinite(previousTotal) ? Math.round(previousTotal) : currentTotal;
  tipValue.style.setProperty('--score-scale', '1');
  tipValue.style.setProperty('--score-scale-prev', '1');
  tipValue.style.transform='scale(1)';
  tip.style.setProperty('--score-font-size', `${SCORE_DISPLAY_BASE_FONT_SIZE}px`);
  tip.appendChild(tipValue);
  tip._valueEl = tipValue;
  boardWrapEl.appendChild(tip);

  if(animateScore && currentTotal > tipValue._lastTotal){
    requestAnimationFrame(()=>animateScoreTipValue(tipValue, currentTotal, tipValue._lastTotal, ballState.initialTotal, state.target, tip));
  } else {
    const scale = computeScoreTooltipScale(currentTotal, ballState.initialTotal, state.target);
    tipValue._scoreScale = scale;
    tipValue.style.transform = 'scale(1)';
    tip.style.setProperty('--score-font-size', `${getScoreDisplayFontSize(scale)}px`);
    tip.style.setProperty('--tooltip-scale', String(scale));
    tip._tooltipScale = scale;
  }

  return {ball, tip};
}
function moveEntityTo(ball,tip,r,c){
  return new Promise(resolve=>{
    void ball.offsetWidth; // force reflow so the browser commits the current position before we change it
    const p=cellPercent(r,c);
    ball.style.left=p.left+'%'; ball.style.top=p.top+'%';
    tip.style.left=p.left+'%'; tip.style.top=p.top+'%';
    setTimeout(resolve, scaledDuration(230));
  });
}
function updateTip(tip, ballState){
  const valueEl = tip?._valueEl || tip;
  const nextTotal = Math.round(ballState.total);
  const previousTotal = Number.isFinite(valueEl._lastTotal) ? valueEl._lastTotal : nextTotal;
  valueEl.textContent = formatNumber(nextTotal);
  if(nextTotal > previousTotal){
    animateScoreTipValue(valueEl, nextTotal, previousTotal, ballState.initialTotal, state.target, tip);
  }
  valueEl._lastTotal = nextTotal;
}
function removeEntity(ball,tip){ ball.remove(); tip.remove(); }
function flashBlocked(r,c){
  const cellEl = boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if(cellEl){ cellEl.classList.remove('blocked-flash'); void cellEl.offsetWidth; cellEl.classList.add('blocked-flash'); }
}
function breakBlockAt(r,c){
  const block=state.cells[r]?.[c]?.block;
  if(!block) return false;
  if(blockHasCore(block,'blue')) return false;
  state.cells[r][c].block = null;
  for(const d of [0,1,2,3]){
    const [dx,dy]=DIR_VEC[d], hr=r+dy, hc=c+dx;
    if(hr<0||hr>=state.rows||hc<0||hc>=state.cols||state.cells[hr][hc].type!=='hole') continue;
    const key=`${hr},${hc},${opposite(d)}`;
    const holeEl=boardEl.querySelector(`.cell.hole[data-r=\"${hr}\"][data-c=\"${hc}\"]`);
    if(state.holeConnections.has(key)){
      const connector=holeEl?.querySelector(`.hole-connector.${DIR_NAMES[opposite(d)]}`);
      if(connector){ connector.classList.add('retracting'); setTimeout(()=>connector.remove(),scaledDuration(290)); }
      state.holeConnections.delete(key);
    }
  }
  const cellEl = boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if(cellEl){
    cellEl.classList.remove('hasblock');
    cellEl.querySelectorAll('.block-visual').forEach(n=>{ n.style.transition='opacity calc(.3s / var(--anim-speed))'; n.style.opacity='0'; });
    setTimeout(()=>{ cellEl.querySelectorAll('.block-visual').forEach(n=>n.remove()); }, scaledDuration(300));
  }
  return true;
}
function wait(ms){ return new Promise(res=>setTimeout(res,scaledDuration(ms))); }

