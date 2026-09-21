// ---------- gameplay effects (data-driven) ----------
// ballState: { total, rate, prop, enh, broke }
const BLOCK_PROP_EFFECTS = {
  steel: { onExit:()=>{} },
  stone: { onExit:(bs, x)=>{ bs.total += 50*x; } },
  wood:  { onExit:(bs, x)=>{ bs.rate += 5*x; } },
  glass: { onExit:(bs, x)=>{ for(let i=0;i<x;i++) bs.total *= 1.5; }, chanceToBreak:0.10 },
  gold:  { onExit:()=>{} },
};

const BALL_PROP_EFFECTS = {
  striped: { onExit:()=>{} },
  grid:    { onExit:(bs, x)=>{ bs.total += 10*x; } },
  glass:   { onExit:(bs, x)=>{ for(let i=0;i<x;i++) bs.total *= 2; } },
  steel:   { onGoal:(bs, x)=>{ for(let i=0;i<x;i++) bs.total *= 1.5; } },
  gold:    { onGoal:(bs, x)=>{ state.money += 1*x; } },
};

const ENHANCEMENT_EFFECTS = {
  spark: { blockExit:(bs,multiplier)=>{ bs.total *= multiplier; }, ballExit:(bs,multiplier)=>{ bs.total *= multiplier; } },
  holo:  { blockExit:(bs)=>{ bs.total += 50; }, ballExit:(bs)=>{ bs.total += 50; } },
};

// Spark multiplier state is runtime-only and scoped to the current shot.
// Each Spark block starts at x1.5 on its first exit and loses 0.05
// after every subsequent exit through that same block during the shot,
// never going below x1. The multiplier is tracked per Spark block.
// The Map is shared by all branches of the shot and is recreated for the
// next shot, so every Spark block resets back to x1.5 between shots.
const SPARK_START_MULTIPLIER = 1.5;
const SPARK_DECAY = 0.05;
const SPARK_MIN_MULTIPLIER = 1.0;
function getBlockSparkMultiplier(block, ballState){
  if(!block || !ballState?.shotMeta) return SPARK_MIN_MULTIPLIER;
  const meta=ballState.shotMeta;
  if(!meta.sparkBlockMultipliers) meta.sparkBlockMultipliers=new Map();
  let value=meta.sparkBlockMultipliers.get(block);
  if(!Number.isFinite(value)) value=SPARK_START_MULTIPLIER;
  value=Math.max(SPARK_MIN_MULTIPLIER, Math.round(value*100)/100);
  meta.sparkBlockMultipliers.set(block,value);
  return value;
}
function consumeBlockSparkMultiplier(block, ballState){
  if(!ballState?.shotMeta) return SPARK_MIN_MULTIPLIER;
  const current=getBlockSparkMultiplier(block, ballState);
  const next=Math.max(SPARK_MIN_MULTIPLIER, Math.round((current-SPARK_DECAY)*100)/100);
  ballState.shotMeta.sparkBlockMultipliers.set(block,next);
  return next;
}
// Ball Spark is different from Block Spark: it never decays.
// During one shot, each distinct block may trigger the ball's Spark only once.
function triggerBallSpark(ballState, blockRef){
  if(ballState?.enh!=='spark' || !ballState?.shotMeta || !blockRef) return false;
  const meta=ballState.shotMeta;
  if(!meta.sparkVisitedBlocks) meta.sparkVisitedBlocks=new Set();
  if(meta.sparkVisitedBlocks.has(blockRef)) return false;
  meta.sparkVisitedBlocks.add(blockRef);
  ENHANCEMENT_EFFECTS.spark.ballExit(ballState, SPARK_START_MULTIPLIER);
  return true;
}

function syncMoneyHud(){
  moneyValEl.textContent = formatMoney(state.money);
}

function coreExitEffects(block, ballState){
  const core=block?.core;
  if(!core || !CORE_DEFS[core.id]) return {tooltips:[], purpleSplit:false, repeatBlock:false};
  const shotMeta=ballState?.shotMeta;
  const tooltips=[];
  const def=CORE_DEFS[core.id];
  const coreTooltip = def.tooltip
    ? {text:def.tooltip, kind:`core-${core.id}`, color:def.color}
    : null;

  if(core.id==='red'){
    // Red has no count, but it may replay this block only once per shot.
    // The actual replay is performed inside blockExitEffects() with skipCore:true.
    return {
      tooltips:[],
      purpleSplit:false,
      repeatBlock:redCoreCanReplay(block, shotMeta)
    };
  }

  if(core.id==='orange' && coreCanUse(block,shotMeta)){
    ballState.total *= 1.5;
    consumeCoreUse(block,shotMeta);
    if(coreTooltip) tooltips.push(coreTooltip);
  } else if(core.id==='yellow' && coreCanUse(block,shotMeta)){
    state.money += 3;
    syncMoneyHud();
    consumeCoreUse(block,shotMeta);
    if(coreTooltip) tooltips.push(coreTooltip);
  } else if(core.id==='green' && coreCanUse(block,shotMeta)){
    if(Math.random()<0.25){
      ballState.total *= 2;
      tooltips.push({text:'x2',kind:'core-green',color:def.color});
    }
    if(Math.random()<0.05){
      state.money += 20;
      syncMoneyHud();
      tooltips.push({text:'+20$',kind:'core-green-money',color:def.color});
    }
  } else if(core.id==='purple' && coreCanUse(block,shotMeta)){
    // Purple performs its split in travel() after the normal first split.
  }
  return {
    tooltips,
    purpleSplit:core.id==='purple' && coreCanUse(block,shotMeta),
    repeatBlock:false
  };
}

function blockExitEffects(block, ballState, options={}){
  const prop = block.property, enh = block.enhancement;
  if(!options.replay) recordBlockPassed(block);
  let brokeBlock = false;
  const tooltips=[];
  let sparkMultiplierUsed = null;

  const propFx = BLOCK_PROP_EFFECTS[prop];
  propFx?.onExit?.(ballState, 1);

  if(prop==='steel'){
    if(!ballState.steelBlocks) ballState.steelBlocks = new Set();
    if(!ballState.steelBlockCounts) ballState.steelBlockCounts = new Map();

    if(!ballState.steelBlocks.has(block)){
      ballState.steelBlocks.add(block);
      ballState.steelBlockCounts.set(block,1);
    } else if(options.replay){
      // A normal repeat visit through the same steel block does not stack.
      // Red core explicitly repeats the steel effect, so it adds one more x1.5
      // and remembers that this multiplier belongs to the red replay for THIS shot.
      const current=Math.max(1,Math.floor(Number(ballState.steelBlockCounts.get(block)||1)));
      ballState.steelBlockCounts.set(block,current+1);
      if(!ballState.shotMeta.redCoreSteelReplayBlocks) ballState.shotMeta.redCoreSteelReplayBlocks=new Set();
      ballState.shotMeta.redCoreSteelReplayBlocks.add(block);
    }
  }

  // Striped balls multiply only the points granted by this block.
  const blockGain = ballState.prop==='striped' ? ballState.rate * 1.5 : ballState.rate;
  ballState.total += blockGain;

  if(!blockHasCore(block,'blue') && propFx?.chanceToBreak && Math.random() < propFx.chanceToBreak){
    brokeBlock = true;
  }

  if(prop==='stone') tooltips.push({text:'+50',kind:'stone'});

  if(enh==='spark'){
    // A red-core replay must reuse the exact multiplier used by the primary
    // pass. This prevents x1.5 -> x1.45 when the intended result is x1.5 -> x1.5.
    const multiplier = Number.isFinite(options.sparkMultiplierOverride)
      ? options.sparkMultiplierOverride
      : getBlockSparkMultiplier(block, ballState);

    if(multiplier>SPARK_MIN_MULTIPLIER){
      ENHANCEMENT_EFFECTS.spark.blockExit(ballState,multiplier);
      tooltips.push({text:`x${multiplier.toFixed(2)}`,kind:'spark'});
      sparkMultiplierUsed=multiplier;
      if(!options.replay) consumeBlockSparkMultiplier(block, ballState);
    }
  }

  if(enh==='holo'){
    ENHANCEMENT_EFFECTS.holo.blockExit(ballState);
    tooltips.push({text:'+50',kind:'holo'});
  }

  ballState.total += (state.typeBonus[block.type] || 0);

  // Gold pays only at level completion. Its red core is resolved there too,
  // independently of whether a ball ever passes through this block.

  if(!options.skipCore && blockHasCore(block,'red') && redCoreCanReplay(block, ballState?.shotMeta)){
    // Mark BEFORE replaying so any recursive/re-entrant path cannot trigger
    // the red core a second time for the same block during this shot.
    markRedCoreReplayed(block, ballState.shotMeta);

    const repeat=blockExitEffects(block, ballState, {
      skipCore:true,
      replay:true,
      sparkMultiplierOverride:sparkMultiplierUsed,
    });
    brokeBlock = brokeBlock || !!repeat.brokeBlock;

    // The red-core tooltip is the same text as the tooltip(s) produced by the
    // repeated property/enhancement effect, but rendered in the red core color.
    // Do this from the repeat result itself so Spark keeps the exact multiplier
    // used by the original pass (e.g. x1.5, not x1.45).
    for(const item of (repeat.tooltips || [])){
      const replayTip=makeRedCoreReplayTooltip(item);
      if(replayTip) tooltips.push(replayTip);
    }
  }

  return {brokeBlock, tooltips, sparkMultiplierUsed};
}

function ballExitEffects(ballState, blockRef){
  const prop = ballState.prop, enh = ballState.enh;
  const tooltips=[];
  BALL_PROP_EFFECTS[prop]?.onExit?.(ballState, 1);
  if(enh==='spark' && triggerBallSpark(ballState, blockRef)){
    tooltips.push({text:`x${SPARK_START_MULTIPLIER.toFixed(1)}`,kind:'spark'});
  }
  if(enh==='holo') ENHANCEMENT_EFFECTS.holo.ballExit(ballState);
  return tooltips;
}

function createBlockExitTooltip(row,col,text,kind,color=null){
  if(!Number.isInteger(row)||!Number.isInteger(col)||!boardWrapEl) return null;
  const tip=document.createElement('div');
  tip.className=`block-exit-tooltip ${kind||''}`.trim();
  tip.textContent=text;
  // Keep the default tooltip size from .block-exit-tooltip; core tooltips only
  // override the accent color.
  if(color){
    tip.style.color=color;
    tip.style.border=`1px solid ${color}`;
    tip.style.textShadow=`0 0 8px ${color}`;
  }
  const p=cellPercent(row,col);
  tip.style.left=p.left+'%';
  tip.style.top=p.top+'%';
  boardWrapEl.appendChild(tip);
  return tip;
}

// Non-blocking block-exit tooltip sequence. Tooltips are visual feedback only,
// so the ball continues travelling while they appear. Multiple tooltips are
// staggered in the requested order: property first, enhancement second.
function animateBlockExitTooltips(row,col,tooltips,generation){
  if(!Array.isArray(tooltips)||!tooltips.length) return true;

  // Property -> enhancement -> core. The next tooltip is not created until the
  // previous one has completed its fade, so only one is visible for this exit.
  const groupOf = item=>{
    const kind=String(item?.kind||'');
    if(kind.startsWith('core-')) return 2;
    if(['stone','steel','gold','wood','glass'].includes(kind)) return 0;
    return 1;
  };
  const sequence=[...tooltips].sort((a,b)=>groupOf(a)-groupOf(b));

  (async()=>{
    for(const item of sequence){
      if(generation!==runGeneration || !state) return;

      const tip=createBlockExitTooltip(row,col,item.text,item.kind,item.color||null);
      if(!tip) continue;
      requestAnimationFrame(()=>tip.classList.add('show'));

      // Match the default tooltip animation timings in the stylesheet.
      await wait(240);
      if(generation!==runGeneration || !state){ tip.remove(); return; }
      await wait(60);
      if(generation!==runGeneration || !state){ tip.remove(); return; }

      tip.classList.remove('show');
      tip.classList.add('hide');
      await wait(180);
      if(tip.isConnected) tip.remove();
    }
  })();

  return true;
}
function removeBallPermanently(ballId){
  if(!ballId || !state) return false;
  const qIndex=state.ballQueue.findIndex(q=>q._id===ballId);
  let changed=false;
  if(qIndex>=0){ state.ballQueue.splice(qIndex,1); state.ballsFired=Math.max(0,state.ballsFired-1); changed=true; }
  const before=state.ballPool.length;
  state.ballPool=state.ballPool.filter(b=>b._id!==ballId);
  changed=changed || state.ballPool.length!==before;
  if(changed){ renderBallQueue(); refreshOpenShop(); refreshOpenGachaBalls(); scheduleAutoSave(); }
  return changed;
}

function finishGlassBranch(ballState,reachedGoal){
  if(ballState?.prop!=='glass') return;
  const meta=ballState.glassShot;
  if(!meta || meta.finished) return;
  meta.active=Math.max(0,meta.active-1);
  if(meta.active!==0) return;
  if(reachedGoal && !meta.lossChecked){
    meta.lossChecked=true;
    if(Math.random()<0.10){
      meta.permanentlyLost=true;
      removeBallPermanently(meta.ballId);
    }
  }
}

function findBlockCell(blockRef){
  if(!blockRef || !state?.cells) return null;
  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    if(state.cells[r][c]?.block===blockRef) return {r,c};
  }
  return null;
}

function createSteelMultiplierTooltip(blockRef, isRedCore=false){
  const pos=findBlockCell(blockRef);
  if(!pos) return null;
  const tip=document.createElement('div');
  tip.className='steel-multiplier-tooltip' + (isRedCore ? ' core-red-steel-tooltip' : '');
  tip.textContent='x1.5';
  if(isRedCore){
    tip.style.color=CORE_COLOR.red;
    tip.style.borderColor=CORE_COLOR.red;
    tip.style.textShadow=`0 0 8px ${CORE_COLOR.red}`;
    tip.style.setProperty('--steel-tooltip-border-color', CORE_COLOR.red);
  }
  const p=cellPercent(pos.r,pos.c);
  tip.style.left=p.left+'%';
  tip.style.top=p.top+'%';
  boardWrapEl.appendChild(tip);
  return tip;
}

function createGoldRewardTooltip(blockRef, isRedCore=false){
  const pos=findBlockCell(blockRef);
  if(!pos) return null;
  const tip=document.createElement('div');
  tip.className='gold-reward-tooltip' + (isRedCore ? ' core-red-gold-tooltip' : '');
  tip.textContent='+3$';
  if(isRedCore){
    tip.style.color=CORE_COLOR.red;
    tip.style.borderColor=CORE_COLOR.red;
    tip.style.textShadow=`0 0 8px ${CORE_COLOR.red}`;
    tip.style.setProperty('--gold-tooltip-border-color', CORE_COLOR.red);
  }
  const p=cellPercent(pos.r,pos.c);
  tip.style.left=p.left+'%';
  tip.style.top=p.top+'%';
  boardWrapEl.appendChild(tip);
  return tip;
}

function getSteelMultiplierEntries(ballState){
  const blocks=Array.from(ballState?.steelBlocks || []);
  const counts=ballState?.steelBlockCounts;
  const redRepeatSet=ballState?.shotMeta?.redCoreSteelReplayBlocks;
  const entries=[];
  for(const block of blocks){
    const count=Math.max(1,Math.floor(Number(counts?.get(block)||1)));
    const redRepeats=redRepeatSet?.has(block) ? 1 : 0;
    const normalCount=Math.max(1, count-redRepeats);
    for(let i=0;i<normalCount;i++) entries.push({block,isRedCore:false});
    if(redRepeats>0) entries.push({block,isRedCore:true});
  }
  return entries;
}

async function animateSteelGoalMultipliers(ballState, goalPopup, generation){
  const steelBlocks = getSteelMultiplierEntries(ballState);
  let activeTip = null;

  for(let i=0;i<steelBlocks.length;i++){
    if(generation!==runGeneration || !state) return false;

    const entry=steelBlocks[i];
    const nextTip=createSteelMultiplierTooltip(entry.block, entry.isRedCore);
    if(!nextTip){
      ballState.total*=1.5;
      updateGoalPopupScore(goalPopup, ballState);
      continue;
    }

    // Stronger chained sequence: show the next tooltip first, then hide the previous
    // one at the same time instead of fully completing one tooltip before starting the next.
    requestAnimationFrame(()=>nextTip.classList.add('show'));
    await wait(70);
    if(generation!==runGeneration || !state){ nextTip.remove(); activeTip?.remove(); return false; }

    ballState.total*=1.5;
    updateGoalPopupScore(goalPopup, ballState, {impact:true, rise:40});

    if(activeTip){
      activeTip.classList.remove('show');
      activeTip.classList.add('hide');
    }

    if(activeTip){
      await wait(100);
      if(generation!==runGeneration || !state){ nextTip.remove(); activeTip.remove(); return false; }
      activeTip.remove();
    }

    activeTip=nextTip;
    await wait(i < steelBlocks.length-1 ? 90 : 260);
  }

  if(activeTip){
    if(generation!==runGeneration || !state){ activeTip.remove(); return false; }
    activeTip.classList.remove('show');
    activeTip.classList.add('hide');
    await wait(100);
    activeTip.remove();
  }
  return true;
}

async function animateGoldBlockRewards(goldBlocks, generation){
  let activeTip = null;

  for(let i=0;i<goldBlocks.length;i++){
    if(generation!==runGeneration || !state) return false;

    const entry=goldBlocks[i];
    const nextTip=createGoldRewardTooltip(entry.block, entry.isRedCore);
    if(!nextTip) continue;

    requestAnimationFrame(()=>nextTip.classList.add('show'));
    await wait(70);
    if(generation!==runGeneration || !state){ nextTip.remove(); activeTip?.remove(); return false; }

    if(activeTip){
      activeTip.classList.remove('show');
      activeTip.classList.add('hide');
    }

    if(activeTip){
      await wait(100);
      if(generation!==runGeneration || !state){ nextTip.remove(); activeTip.remove(); return false; }
      activeTip.remove();

      // Each gold block pays exactly once when its tooltip finishes disappearing.
      state.money += 3;
      syncMoneyHud();
    }

    activeTip=nextTip;
    await wait(i < goldBlocks.length-1 ? 90 : 260);
  }

  if(activeTip){
    if(generation!==runGeneration || !state){ activeTip.remove(); return false; }
    activeTip.classList.remove('show');
    activeTip.classList.add('hide');
    await wait(100);
    activeTip.remove();

    state.money += 3;
    syncMoneyHud();
  }

  return true;
}

function syncGoalPopupScoreSize(goalPopup, ballState){
  if(!goalPopup || !ballState || !state) return;
  const scale=computeScoreTooltipScale(ballState.total, ballState.initialTotal, state.target);
  goalPopup.style.fontSize=`${getScoreDisplayFontSize(scale)}px`;
  goalPopup._scoreScale=scale;
}

function getGoalPopupValueEl(goalPopup){
  return goalPopup?._valueEl || goalPopup;
}

function pulseGoalPopupValue(goalPopup){
  const valueEl=getGoalPopupValueEl(goalPopup);
  if(!valueEl) return;
  valueEl.classList.remove('impact');
  void valueEl.offsetWidth;
  valueEl.classList.add('impact');
}

// Popup flight uses one constant pixel-per-second speed for the entire life of the popup.
// Extending the flight reuses that same speed, so there is no visible pause, jump, or acceleration.
const GOAL_POPUP_FLIGHT_SPEED = 42; // px/s
const GOAL_POPUP_FIRST_IMPACT_DELAY = 180; // ms: short pause after popup appears before the first extra-score source
const GOAL_POPUP_IMPACT_RISE = 42;  // extra travel added for each new score impact
const GOAL_POPUP_FINAL_RISE = 56;   // final travel while fading out
const GOAL_POPUP_FINAL_FADE_DURATION = 520; // ms: quick fade after the final score impact

function getGoalPopupCurrentTop(goalPopup){
  const computedTop=parseFloat(getComputedStyle(goalPopup).top);
  return Number.isFinite(computedTop) ? computedTop : 0;
}

function continueGoalPopupFlight(goalPopup, extraRise=0, {fade=false}={}){
  if(!goalPopup || !boardWrapEl) return;

  const currentTop=getGoalPopupCurrentTop(goalPopup);
  const speed=GOAL_POPUP_FLIGHT_SPEED;
  const distance=Math.max(0, Number(extraRise)||0);

  if(goalPopup._flightAnim){
    try{ goalPopup._flightAnim.cancel(); }catch{}
    goalPopup._flightAnim=null;
  }

  goalPopup.style.top=`${currentTop}px`;
  goalPopup.style.transform='translate(-50%, -50%) scale(1)';
  if(!fade) goalPopup.style.opacity='1';

  if(distance<=0) return;

  const duration=Math.max(1, scaledDuration((distance/speed)*1000));
  const nextTop=currentTop-distance;
  goalPopup._flightAnim=goalPopup.animate(
    [
      {top:`${currentTop}px`},
      {top:`${nextTop}px`}
    ],
    {duration,easing:'linear',fill:'forwards'}
  );
  goalPopup._flightAnim.onfinish=()=>{
    if(goalPopup._flightAnim) goalPopup._flightAnim=null;
  };
}

function startGoalPopupFlight(goalPopup, row, col){
  const boardRect=boardWrapEl.getBoundingClientRect();
  const startTop=boardRect.height*((row+0.5)/state.rows);

  goalPopup.style.top=`${startTop}px`;
  goalPopup.style.opacity='1';
  goalPopup.style.transform='translate(-50%, -50%) scale(1)';

  // The popup starts moving upward immediately, at one constant linear speed.
  continueGoalPopupFlight(goalPopup, 70);
}

function updateGoalPopupScore(goalPopup, ballState, {impact=true, rise=38}={}){
  if(!goalPopup || !ballState || !state) return;
  const valueEl=getGoalPopupValueEl(goalPopup);
  const nextTotal=Math.round(ballState.total);
  const previousTotal=Number.isFinite(goalPopup._lastTotal) ? goalPopup._lastTotal : nextTotal;
  if(valueEl) valueEl.textContent=formatNumber(nextTotal);
  syncGoalPopupScoreSize(goalPopup, ballState);
  goalPopup._lastTotal=nextTotal;

  if(nextTotal>previousTotal){
    // The parent never pauses: only the value itself receives the impact animation.
    if(impact) pulseGoalPopupValue(goalPopup);
    continueGoalPopupFlight(goalPopup, Number.isFinite(rise) ? rise : GOAL_POPUP_IMPACT_RISE);
  }
}

async function finishGoalPopup(goalPopup, generation){
  if(!goalPopup) return;
  if(generation!==runGeneration || !state){ goalPopup.remove(); return; }

  // No pause after the final score: extend the same constant-speed flight and fade
  // at the same time. The popup therefore follows one straight, uninterrupted path.
  const finalRise=GOAL_POPUP_FINAL_RISE;
  const duration=Math.max(1, scaledDuration((finalRise/GOAL_POPUP_FLIGHT_SPEED)*1000));
  continueGoalPopupFlight(goalPopup, finalRise, {fade:true});

  const fadeDuration=Math.max(1, scaledDuration(GOAL_POPUP_FINAL_FADE_DURATION));
  const fade=goalPopup.animate(
    [
      {opacity:1},
      {opacity:0}
    ],
    {duration:fadeDuration,easing:'linear',fill:'forwards'}
  );
  goalPopup._fadeAnim=fade;
  await new Promise(resolve=>{ fade.onfinish=resolve; fade.oncancel=resolve; });
  if(goalPopup._fadeAnim===fade) goalPopup._fadeAnim=null;
}

function ballGoalEffects(ballState){
  const prop=ballState.prop;
  // Steel block multipliers are resolved visually/sequentially in travel() so the
  // player can see exactly which steel block grants each x1.5.
  BALL_PROP_EFFECTS[prop]?.onGoal?.(ballState,1);
  if(prop==='gold' || prop==='steel') syncMoneyHud();
}

function createLostBallScorePopup(ballState, row, col){
  if(!ballState || !Number.isInteger(row) || !Number.isInteger(col) || !boardWrapEl) return null;

  const payoutState={
    total:Math.round(ballState.total/2),
    initialTotal:Math.round(ballState.total/2)
  };
  const popup=document.createElement('div');
  popup.className='ball-goal-popup steel-sequence';
  const value=document.createElement('span');
  value.className='ball-goal-popup-value';
  value.textContent=formatNumber(payoutState.total);
  popup._valueEl=value;
  popup._lastTotal=payoutState.total;

  const scale=computeScoreTooltipScale(payoutState.total, payoutState.initialTotal, state.target);
  popup.style.fontSize=`${getScoreDisplayFontSize(scale)}px`;
  const goalColor = ballState.enh ? ENH_COLOR[ballState.enh] : (ballState.prop ? PROP_COLOR[ballState.prop] : 'var(--amber)');
  popup.style.color=goalColor || 'var(--amber)';

  const pos=cellPercent(row,col);
  popup.style.left=pos.left+'%';
  popup.style.top=pos.top+'%';
  popup.appendChild(value);
  boardWrapEl.appendChild(popup);
  startGoalPopupFlight(popup,row,col);
  requestAnimationFrame(()=>pulseGoalPopupValue(popup));
  return {popup,payoutState};
}

async function animateSteelLostBallMultipliers(ballState, payoutState, popup, generation){
  const steelBlocks=getSteelMultiplierEntries(ballState);
  let activeTip=null;

  for(let i=0;i<steelBlocks.length;i++){
    if(generation!==runGeneration || !state) return false;
    const entry=steelBlocks[i];
    const nextTip=createSteelMultiplierTooltip(entry.block, entry.isRedCore);
    if(!nextTip){
      payoutState.total*=1.5;
      updateGoalPopupScore(popup,payoutState,{impact:true,rise:40});
      continue;
    }

    requestAnimationFrame(()=>nextTip.classList.add('show'));
    await wait(70);
    if(generation!==runGeneration || !state){ nextTip.remove(); activeTip?.remove(); return false; }

    payoutState.total*=1.5;
    updateGoalPopupScore(popup,payoutState,{impact:true,rise:40});

    if(activeTip){
      activeTip.classList.remove('show');
      activeTip.classList.add('hide');
      await wait(100);
      if(generation!==runGeneration || !state){ nextTip.remove(); activeTip.remove(); return false; }
      activeTip.remove();
    }

    activeTip=nextTip;
    await wait(i < steelBlocks.length-1 ? 90 : 260);
  }

  if(activeTip){
    if(generation!==runGeneration || !state){ activeTip.remove(); return false; }
    activeTip.classList.remove('show');
    activeTip.classList.add('hide');
    await wait(100);
    activeTip.remove();
  }
  return true;
}

async function awardLostInvertBall(ballState, row, col, generation=runGeneration){
  if(ballState?.enh!=='invert' || ballState.lostScorePaid) return true;
  ballState.lostScorePaid=true;

  const created=createLostBallScorePopup(ballState,row,col);
  if(!created){
    const points=Math.round((ballState.total/2));
    state.score += points;
    if(ballState.counter) ballState.counter.points=(ballState.counter.points||0)+points;
    scoreValEl.textContent=formatNumber(state.score);
    return true;
  }

  const {popup,payoutState}=created;
  await wait(GOAL_POPUP_FIRST_IMPACT_DELAY);
  if(generation!==runGeneration || !state){ popup.remove(); return false; }

  const steelResolved=await animateSteelLostBallMultipliers(ballState,payoutState,popup,generation);
  if(!steelResolved || generation!==runGeneration || !state){ popup.remove(); return false; }

  await finishGoalPopup(popup,generation);
  if(generation!==runGeneration || !state){ popup.remove(); return false; }

  popup.remove();
  const points=Math.round(payoutState.total);
  state.score += points;
  if(ballState.counter) ballState.counter.points=(ballState.counter.points||0)+points;
  scoreValEl.textContent=formatNumber(state.score);
  return true;
}

async function loseBall(ball, tip, r, c, ballState=null){
  if(Number.isInteger(r) && Number.isInteger(c)) flashBlocked(r,c);
  ball.classList.add('lost');
  tip.style.opacity='0';

  // Invert balls show the same upward score popup as a goal, paying half of
  // their currently accumulated score. Steel-block multipliers are still applied
  // to that 50% payout before it is added to the stage score.
  const generation=runGeneration;
  await wait(300);
  removeEntity(ball,tip);
  if(Number.isInteger(r) && Number.isInteger(c)){
    const ok=await awardLostInvertBall(ballState,r,c,generation);
    if(!ok) return [];
  } else {
    await awardLostInvertBall(ballState,
      Number.isInteger(ballState?.lastRow) ? ballState.lastRow : 0,
      Number.isInteger(ballState?.lastCol) ? ballState.lastCol : 0,
      generation);
  }

  finishGlassBranch(ballState,false);
  return [];
}

async function travel(ball, tip, row, col, dir, ballState, counter, generation=runGeneration){
  if(generation!==runGeneration || !state){
    removeEntity(ball,tip);
    return [];
  }
  counter.launched++;
  ballState.lastRow=row;
  ballState.lastCol=col;
  const [dx,dy] = DIR_VEC[dir];
  const nr=row+dy, nc=col+dx;

  if(nr<0||nr>=state.rows||nc<0||nc>=state.cols){
    const p = cellPercent(row,col);
    const L=(p.left+dx*40)+'%', T=(p.top+dy*40)+'%';
    ball.style.left=L; ball.style.top=T; tip.style.left=L; tip.style.top=T;
    await wait(230);
    if(generation!==runGeneration || !state){ removeEntity(ball,tip); return []; }
    return loseBall(ball, tip, undefined, undefined, ballState);
  }

  await moveEntityTo(ball,tip,nr,nc);
  if(generation!==runGeneration || !state){ removeEntity(ball,tip); return []; }
  const cellData = state.cells[nr][nc];

  if(cellData.type==='black'){
    return loseBall(ball, tip, nr, nc, ballState);
  }

  if(cellData.type==='hole'){
    const goalPopup = document.createElement('div');
    goalPopup.className='ball-goal-popup steel-sequence';
    const goalValue=document.createElement('span');
    goalValue.className='ball-goal-popup-value';
    goalValue.textContent=formatNumber(Math.round(ballState.total));
    goalPopup._valueEl=goalValue;
    goalPopup._lastTotal=Math.round(ballState.total);
    const tooltipScoreScale = Number.isFinite(tip?._valueEl?._scoreScale) ? tip._valueEl._scoreScale : 1;
    goalPopup.style.fontSize=`${getScoreDisplayFontSize(tooltipScoreScale)}px`;
    const goalColor = ballState.enh ? ENH_COLOR[ballState.enh] : (ballState.prop ? PROP_COLOR[ballState.prop] : 'var(--amber)');
    goalPopup.style.color=goalColor || 'var(--amber)';
    const goalPos=cellPercent(nr,nc);
    goalPopup.style.left=goalPos.left+'%';
    goalPopup.style.top=goalPos.top+'%';
    goalPopup.appendChild(goalValue);
    boardWrapEl.appendChild(goalPopup);
    startGoalPopupFlight(goalPopup,nr,nc);

    // Initial appearance impact: shake/zoom once as the popup first appears.
    // The impact is applied only to the inner value so the popup keeps flying
    // upward continuously without disturbing its parent flight path.
    requestAnimationFrame(()=>pulseGoalPopupValue(goalPopup));

    ball.classList.add('scored');
    tip.style.opacity='0';

    // Let the popup establish itself visually before any secondary score source is applied.
    await wait(GOAL_POPUP_FIRST_IMPACT_DELAY);
    if(generation!==runGeneration || !state){ goalPopup.remove(); removeEntity(ball,tip); return []; }

    // Every score increase while the popup is alive extends its upward flight
    // and triggers a strong zoom/shake on the score itself.
    const steelResolved=await animateSteelGoalMultipliers(ballState,goalPopup,generation);
    if(!steelResolved || generation!==runGeneration || !state){ goalPopup.remove(); removeEntity(ball,tip); return []; }

    const beforeGoalEffects=ballState.total;
    ballGoalEffects(ballState);
    updateTip(tip, ballState);
    updateGoalPopupScore(goalPopup, ballState, {impact:ballState.total>beforeGoalEffects, rise:GOAL_POPUP_IMPACT_RISE});

    await finishGoalPopup(goalPopup,generation);
    if(generation!==runGeneration || !state){ removeEntity(ball,tip); return []; }
    goalPopup.remove();
    removeEntity(ball,tip);
    counter.scored++;
    if(ballState.broke) counter.broke=(counter.broke||0)+1;
    const points=ballState.broke ? 0 : Math.round(ballState.total);
    state.score += points;
    counter.points=(counter.points||0) + points;
    scoreValEl.textContent=formatNumber(state.score);
    finishGlassBranch(ballState,true);

    return [points];
  }

  if(cellData.type==='node' || (cellData.type==='empty' && !cellData.block)){
    return loseBall(ball, tip, nr, nc, ballState);
  }

  const entrySide = opposite(dir);
  const blockRef = cellData.block;
  const sides = openSides(blockRef);
  if(!sides.includes(entrySide)){
    return loseBall(ball, tip, nr, nc, ballState);
  }

  if(cellData.debuff && !blockIgnoresCellHazards(blockRef)){
    // Keep the same ball entity and continue immediately; no re-spawn means no visible pause.
    const exits=sides.filter(s=>s!==entrySide);
    if(!exits.length) return loseBall(ball,tip,nr,nc,ballState);

    const debuffCellEl = boardEl.querySelector(`.cell.debuff-cell[data-r="${nr}"][data-c="${nc}"]`);
    pulseDebuffBlock(debuffCellEl);

    const exitDir=pick(exits);
    return travel(ball,tip,nr,nc,exitDir,ballState,counter,generation);
  }

  const previousTotal = ballState.total;
  const blockExitResult = blockExitEffects(blockRef, ballState);
  const ballExitTooltips = ballExitEffects(ballState, blockRef);
  const coreResult = coreExitEffects(blockRef, ballState);
  const invertBlock = blockRef.enhancement === 'invert';

  const brokeBlock = !!blockExitResult?.brokeBlock;
  if(brokeBlock) breakBlockAt(nr,nc);

  // A glass ball checks its 10% break chance after every block exit. If it breaks,
  // it stops at this block immediately and loses all accumulated score.
  if(ballState.prop==='glass' && Math.random() < 0.10){
    ballState.broke=true;
    counter.broke=(counter.broke||0)+1;
    ball.classList.add('lost');
    tip.style.opacity='0';
    await wait(300);
    removeEntity(ball,tip);
    if(ballState.enh==='invert'){
      const ok=await awardLostInvertBall(ballState,nr,nc,generation);
      if(!ok) return [];
    }
    if(ballState.glassShot?.spawnedExtra){
      finishGlassBranch(ballState,false);
    } else {
      if(ballState.glassShot) ballState.glassShot.finished=true;
      removeBallPermanently(ballState._ballId);
    }
    return [0];
  }

  // Normal first pass splits across every valid exit; later passes choose one exit.
  // Invert gives the shot up to two additional split opportunities. Each such
  // opportunity uses the same exit fan-out as T / Plus blocks.
  const allExits = sides.filter(s=>s!==entrySide);
  const canInvertSplit = invertBlock && ballState.shotMeta && ballState.shotMeta.invertSpawns < ballState.shotMeta.maxInvertSpawns;
  const canPurpleSplit = blockHasCore(blockRef,'purple') && blockRef._splitUsed && allExits.length>1 && coreCanUse(blockRef, ballState.shotMeta);
  let exits;
  if(!blockRef._splitUsed){
    blockRef._splitUsed = true;
    exits = allExits;
    if(invertBlock) ballState.shotMeta.invertSpawns++;
  } else if(canInvertSplit){
    ballState.shotMeta.invertSpawns++;
    exits = allExits;
  } else if(canPurpleSplit){
    consumeCoreUse(blockRef, ballState.shotMeta);
    exits = allExits;
    if(CORE_DEFS.purple.tooltip){
      coreResult.tooltips.push({text:CORE_DEFS.purple.tooltip,kind:'core-purple',color:CORE_DEFS.purple.color});
    }
  } else {
    exits = [pick(allExits)];
  }

  // Tooltips are non-blocking visual feedback. Their visual order is always:
  // property -> enhancement -> core, with only one tooltip visible at once.
  const exitTooltips = [
    ...(blockExitResult?.tooltips || []),
    ...ballExitTooltips,
    ...(coreResult?.tooltips || [])
  ];
  animateBlockExitTooltips(nr,nc,exitTooltips,generation);

  removeEntity(ball,tip);

  const branches = [];
  if(ballState.prop==='glass' && ballState.glassShot){
    const childCount=exits.length;
    ballState.glassShot.active += childCount-1;
    if(childCount>1) ballState.glassShot.spawnedExtra=true;
  }
  exits.forEach(exitDir=>{
    const childState={
      total:ballState.total, rate:ballState.rate, prop:ballState.prop, enh:ballState.enh,
      initialTotal:ballState.initialTotal, _ballId:ballState._ballId, broke:ballState.broke,
      steelBlocks:new Set(ballState.steelBlocks||[]),
      steelBlockCounts:new Map(ballState.steelBlockCounts||[]),
      glassShot:ballState.glassShot,
      shotMeta:ballState.shotMeta, counter:ballState.counter, lostScorePaid:false
    };
    const c1=createBallEntity(nr,nc,childState,true,previousTotal);
    branches.push(travel(c1.ball,c1.tip,nr,nc,exitDir,childState,counter));
  });
  const results = await Promise.all(branches);
  return results.flat();
}

async function onNodeClick(){
  if(state.resolving || state.phase!=='playing' || state.targeting) return;
  if(state.ballsFired >= state.ballQueue.length) return;
  const generation = runGeneration;
  state.resolving = true;

  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    const b = state.cells[r][c].block;
    if(b) b._splitUsed = false;
  }

  const idx = state.ballsFired;
  syncBallQueueFromPool();
  const queued = state.ballQueue[idx];
  const canonical = state.ballPool.find(b=>b._id===queued._id);
  if(canonical){
    queued.property = canonical.property || null;
    queued.enhancement = canonical.enhancement || null;
  }
  queued.fired = true;
  state.ballsFired++;
  renderBallQueue();

  const counter = {launched:0, scored:0, broke:0, points:0};
  const shotMeta = {
    invertSpawns:0,
    maxInvertSpawns:2,
    counter,
    sparkBlockMultipliers:new Map(),
    sparkVisitedBlocks:new Set(),
    coreUses:new Map(),
    redCoreReplayedBlocks:new Set(),
    redCoreSteelReplayBlocks:new Set()
  };
  state._activeShotMeta = shotMeta;
  const glassShot = queued.property==='glass' ? {
    ballId:queued._id, active:1,
    spawnedExtra:false, lossChecked:false, finished:false
  } : null;
  function makeBallState(){
    const initialTotal=50+state.startBonus;
    return {
      initialTotal, total:initialTotal, rate:10+state.baseRateBonus, prop:queued.property, _ballId:queued._id,
      enh:queued.enhancement,
      broke:false, steelBlocks:new Set(), steelBlockCounts:new Map(), glassShot, shotMeta, counter, lostScorePaid:false
    };
  }
  // Ball Invert no longer duplicates the ball on launch; its effect is paid on loss.
  const initialStates=[makeBallState(false)];

  const branchPromises = initialStates.map(bs=>{
    const ent = createBallEntity(state.node.r, state.node.c, bs);
    return travel(ent.ball, ent.tip, state.node.r, state.node.c, state.node.dir, bs, counter, generation);
  });
  const resultsArrays = await Promise.all(branchPromises);
  if(generation!==runGeneration || !state){
    if(state) state._activeShotMeta = null;
    return;
  }
  const results = resultsArrays.flat();

  const gained = counter.points || 0;

  if(gained>0){
    let msg = `${counter.scored}/${counter.launched} bóng về đích — +${gained} điểm`;
    if(counter.broke) msg += ` (${counter.broke} bóng vỡ)`;
  } else {
  }

  state.resolving = false;
  state._activeShotMeta = null;
  render();
  await checkEndState();
  saveGame({silent:true});
}

function getWinBonus(){
  const minBoardSize = Math.min(Number(state.rows)||0, Number(state.cols)||0);
  return Math.max(0, minBoardSize - 1);
}

async function checkEndState(){
  if(state.score >= state.target){
    const unfired = state.ballQueue.length - state.ballsFired;
    const interestCap = 5 + state.interestCapBonus;
    const interest = Math.min(Math.floor(state.money/5), interestCap);
    const ballBonus = unfired*2;

    const goldBlocks = [];
    if(state.cells) for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
      const b = state.cells[r][c]?.block;
      if(b?.property==='gold') {
        // Gold's normal effect is exactly once when the level is won.
        goldBlocks.push({block:b,isRedCore:false});
        // A red-core gold block automatically repeats the same level-end
        // reward once. This is independent of ball traversal.
        if(blockHasCore(b,'red')) goldBlocks.push({block:b,isRedCore:true});
      }
    }

    // The last scoring ball has finished. Show each gold-block reward
    // while the board is still fully visible, then start board hide.
    const generation = runGeneration;
    const goldResolved = await animateGoldBlockRewards(goldBlocks, generation);
    if(!goldResolved || generation!==runGeneration || !state) return;

    state.phase = 'reward';
    runBoardHideAnimation(()=>showLevelReward({winBonus:getWinBonus(), unfired, ballBonus, interest}));
  } else if(state.ballsFired >= state.ballQueue.length){
    state.phase = 'gameover';
    renderCardHand();
    showOverlay('lose', 'GAME OVER', `Dừng lại ở màn ${formatNumber(state.level)}, đạt ${formatNumber(state.score)}/${formatNumber(state.target)} điểm. Tổng tiền tích luỹ: ${formatMoney(state.money)}.`);
  }
}

function runBoardHideAnimation(onComplete){
  if(!state?.cells || !state.rows || !state.cols){
    onComplete?.();
    return;
  }
  if(boardRevealTimer){
    clearTimeout(boardRevealTimer);
    boardRevealTimer=null;
  }
  state._boardReveal = false;
  state._boardHide = true;
  state._handReveal = false;
  state._handHide = true;
  state._boardHideComplete = typeof onComplete === 'function' ? onComplete : null;
  render();
}

function recycleCurrentLevelBlocksToBag(){
  if(!state) return;
  if(state.cells){
    for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
      const b=state.cells[r][c]?.block;
      if(b){
        state.bag.push(b);
        state.cells[r][c].block=null;
      }
    }
  }
  state.bag.push(...state.hand.filter(Boolean));
  state.bag.push(...state.discardPile.filter(Boolean));
  state.hand=[];
  state.discardPile=[];
  state.discardsLeft=getMaxDiscards();
  state.bag.forEach(block=>{ if(block) block.rotation=0; });
  shuffle(state.bag);
}

function showLevelReward(info){
  const rewardId = ++rewardGeneration;
  shopOverlayEl.classList.add('hidden');
  shopOverlayEl.innerHTML='';
  const winBonus = Number.isFinite(info.winBonus) ? info.winBonus : getWinBonus();
  // Gold-block money has already been awarded during each +3$ tooltip sequence.
  const total = winBonus + info.ballBonus + info.interest;
  state._handRewardHidden = true;
  document.querySelector('.hand-row')?.classList.add('reward-hidden');

  overlayEl.classList.add('reward-clear');
  overlayPanelEl.className='overlay-panel win reward-anim-in';
  overlayTitleEl.innerHTML='<span class="reward-step">Qua màn!</span>';
  overlayTextEl.style.textAlign='left';
  overlayTextEl.style.lineHeight='1.6';
  overlayTextEl.innerHTML=`
    <div class="reward-layout">
      <div class="reward-row"><span class="reward-label reward-win-label reward-step">- Thưởng thắng:</span><span class="reward-value reward-step">${formatNumber(winBonus)}$</span></div>
      <div class="reward-row"><span class="reward-label reward-step">- ${formatNumber(info.unfired)} bóng còn sót (${formatNumber(2)}$ mỗi bóng):</span><span class="reward-value reward-step">${formatNumber(info.ballBonus)}$</span></div>
      <div class="reward-row"><span class="reward-label reward-step">- Tiền lãi (Mỗi 5$ nhận thêm 1$, tối đa ${formatMoney(5 + state.interestCapBonus)}):</span><span class="reward-value reward-step">${formatNumber(info.interest)}$</span></div>
    </div>`;

  const btn=document.getElementById('overlayBtn');
  // The reward button is shared with the lose overlay/restart flow.
  // Reset every transient state and bind this button to a unique reward cycle.
  btn.className='gold reward-step';
  delete btn.dataset.busy;
  btn.disabled=false;
  btn.textContent=`Nhận tiền: ${formatNumber(total)}$`;
  btn.onclick=()=>{
    // Ignore stale handlers from an older reward/run and prevent double collection.
    if(rewardId!==rewardGeneration || btn.dataset.busy==='1' || state.phase!=='reward') return;
    btn.dataset.busy='1';
    btn.disabled=true;

    // No scale/zoom-out animation when collecting the reward.
    state.money += total;
    state.phase='shop';
    state._boardHideComplete=null;
    state._handRewardHidden=true;
    document.querySelector('.hand-row')?.classList.add('reward-hidden');
    state.score=0;
    recycleCurrentLevelBlocksToBag();
    state.ballsFired=0;
    state.ballQueue=makeBallQueue();
    document.querySelectorAll('.ball, .ball-tooltip, .ball-goal-popup, .block-exit-tooltip').forEach(el=>el.remove());
    moneyValEl.textContent=formatMoney(state.money);
    scoreValEl.textContent=formatNumber(state.score);
    renderBallQueue();
    renderHand();
    renderCardHand();
    bagCountEl.textContent=`Túi khối còn lại: ${formatNumber(state.bag.length)}`;
    discardCountEl.textContent=`(${formatNumber(state.discardsLeft)}/${formatNumber(getMaxDiscards())})`;
    discardBtnEl.disabled=true;
    hideOverlay();
    overlayEl.classList.remove('reward-clear');
    openShop();
    // The reward has been consumed; while the shop is active the shared button
    // must not retain a stale reward handler.
    btn.dataset.busy='';
    btn.disabled=false;
    btn.onclick=newRun;
    scheduleAutoSave();
  };
  overlayEl.classList.remove('hidden');

  requestAnimationFrame(()=>{
    const title=overlayPanelEl.querySelector('#overlayTitle .reward-step');
    if(title) setTimeout(()=>title.classList.add('reward-show'),0);
    const labels=[...overlayPanelEl.querySelectorAll('.reward-row .reward-label')];
    const values=[...overlayPanelEl.querySelectorAll('.reward-row .reward-value')];
    // Keep the reward reveal timings consistent with the selected animation speed.
    // CSS animation durations already use --anim-speed, so the JS delays must
    // use the same scale as well.
    let delay=scaledDuration(500);
    for(let i=0;i<labels.length;i++){
      setTimeout(()=>labels[i].classList.add('reward-show'),delay);
      delay += scaledDuration(220);
      setTimeout(()=>values[i]?.classList.add('reward-show'),delay);
      delay += scaledDuration(260);
    }
    setTimeout(()=>btn.classList.add('reward-show'),delay+scaledDuration(500));
  });
}

