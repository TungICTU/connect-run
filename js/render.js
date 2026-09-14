// ---------- DOM refs ----------
const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const bagCountEl = document.getElementById('bagCount');
const scoreValEl = document.getElementById('scoreVal');
const targetValEl = document.getElementById('targetVal');
const moneyValEl = document.getElementById('moneyVal');
const levelValEl = document.getElementById('levelVal');
const ballQueueEl = document.getElementById('ballQueue');
const cardHandEl = document.getElementById('cardHand');
const targetBannerEl = document.getElementById('targetBanner');
const boardWrapEl = document.querySelector('.board-wrap');
const discardBtnEl = document.getElementById('discardBtn');
const discardCountEl = document.getElementById('discardCount');
let refreshAnimSlots = new Set();
let boardRevealTimer = null;
let boardRevealToken = 0;
discardBtnEl.addEventListener('click', discardHand);
let placeAnimCell = null; // {r,c} of the block placed by the most recent drop, for the pop-in animation
let swapAnim = null; // {source:{r,c},target:{r,c}} for two-block movement animation

function renderBlockArms(container, block){
  container.querySelectorAll('.block-visual, .block-core-dot').forEach(n=>n.remove());
  const visual = document.createElement('div'); visual.className='block-visual';
  if(block.property) visual.dataset.prop = block.property;
  if(block.enhancement) visual.dataset.enh = block.enhancement;
  const deg = block.rotation*90;
  visual.dataset.deg = deg;
  visual.style.setProperty('--block-base-rotation', `${deg}deg`);
  visual.style.transform = `rotate(${deg}deg)`;
  const hub = document.createElement('div'); hub.className='hub';
  visual.appendChild(hub);
  BASE_SIDES[block.type].forEach(side=>{
    const arm = document.createElement('div');
    arm.className = 'arm arm-' + DIR_NAMES[side];
    visual.appendChild(arm);
  });
  if(block.core && CORE_DEFS[block.core.id]){
    const coreDot=document.createElement('div');
    coreDot.className='block-core-dot';
    coreDot.dataset.core=block.core.id;
    coreDot._coreBlock = block;
    if(coreHasCount(block.core)){
      coreDot.textContent=String(getCoreDisplayCount(block));
    }
    container.appendChild(visual);
    container.appendChild(coreDot);
  } else {
    container.appendChild(visual);
  }
  markDebugTarget(container, block, 'block');
  if(block.property) container.style.setProperty('--prop-color', PROP_COLOR[block.property]);
  if(block.enhancement) container.style.setProperty('--enh-color', ENH_COLOR[block.enhancement]);
  container.addEventListener('mouseenter', ()=> showHoverTip(container, blockTooltip(block)));
  container.addEventListener('mouseleave', hideHoverTip);
}

function prepareBoardRender(boardReveal){
  state._animateNewHoleConnections = new Set();
  if(!placeAnimCell) return;

  const {r,c}=placeAnimCell;
  const block=state.cells[r][c].block;
  for(const d of [0,1,2,3]){
    const [dx,dy]=DIR_VEC[d], hr=r+dy, hc=c+dx;
    if(hr<0||hr>=state.rows||hc<0||hc>=state.cols || state.cells[hr][hc].type!=='hole' || !block) continue;
    const key=`${hr},${hc},${opposite(d)}`;
    if(openSides(block).includes(d) && !state.holeConnections.has(key)) state._animateNewHoleConnections.add(key);
  }
}

function applyBoardCellAnimation(el, r, c, boardReveal, boardHide){
  if(boardReveal){
    const revealIndex = r * state.cols + c;
    const sign = ((r + c) % 2 === 0) ? 1 : -1;
    const angle = sign * (10 + ((r * 3 + c) % 4) * 7);
    el.classList.add('board-reveal-cell');
    el.style.setProperty('--reveal-delay', `${revealIndex * 24}ms`);
    el.style.setProperty('--reveal-rotate', `${angle}deg`);
  } else if(boardHide){
    const hideIndex = (state.rows * state.cols - 1) - (r * state.cols + c);
    const sign = ((r + c) % 2 === 0) ? 1 : -1;
    const angle = sign * (10 + ((r * 3 + c) % 4) * 7);
    el.classList.add('board-hide-cell');
    el.style.setProperty('--hide-delay', `${hideIndex * 24}ms`);
    el.style.setProperty('--hide-rotate', `${angle}deg`);
  }
}

function renderNodeCell(el){
  el.dataset.dir = DIR_NAMES[state.node.dir];
  const arm = document.createElement('div'); arm.className = 'arm arm-'+DIR_NAMES[state.node.dir];
  const hub = document.createElement('div'); hub.className='hub';
  el.appendChild(arm); el.appendChild(hub);
  el.addEventListener('click', onNodeClick);
}

function renderHoleCell(el, r, c){
  const r2=document.createElement('div'); r2.className='ring r2';
  el.appendChild(r2);
  const nextConnections = new Set();

  for(const d of [0,1,2,3]){
    const [dx,dy]=DIR_VEC[d];
    const nr=r+dy, nc=c+dx;
    if(nr<0||nr>=state.rows||nc<0||nc>=state.cols) continue;
    const nb=state.cells[nr][nc].block;
    if(!nb || !openSides(nb).includes(opposite(d))) continue;
    const key=`${r},${c},${d}`;
    nextConnections.add(key);
    const connector=document.createElement('div');
    connector.className='hole-connector '+DIR_NAMES[d];
    if(state._animateNewHoleConnections?.has(key)) connector.classList.add('forming');
    el.appendChild(connector);
  }

  for(const key of [...state.holeConnections]){
    if(!key.startsWith(`${r},${c},`) || nextConnections.has(key)) continue;
    const d=+key.split(',')[2];
    const connector=document.createElement('div');
    connector.className='hole-connector '+DIR_NAMES[d]+' retracting';
    el.appendChild(connector);
    setTimeout(()=>connector.remove(),scaledDuration(290));
    state.holeConnections.delete(key);
  }
  for(const key of nextConnections) state.holeConnections.add(key);
}

function renderBlackCell(el){
  el.classList.add('black-block');
  blackBlockTooltip(el);
}

function renderLockIcon(el, isFilled){
  const icon=document.createElement('div');
  icon.className='cell-lock-icon ' + (isFilled ? 'is-filled' : 'is-empty');
  const keyhole=document.createElement('div');
  keyhole.className='lock-keyhole';
  icon.appendChild(keyhole);
  el.appendChild(icon);
}

function showLockedCellHoverTip(targetEl, block){
  hoverTipEl._targetEl = targetEl;
  hoverTipEl.innerHTML = '';
  hoverTipEl.classList.remove('hazard-tooltip', 'debuff-tooltip-stack');
  hoverTipEl.classList.add('locked-tooltip-stack');

  if(block){
    const blockInfo = blockTooltip(block);
    const blockWrap = document.createElement('div');
    blockWrap.className='hover-tip';
    blockWrap.style.position='static';
    blockWrap.style.maxWidth='none';
    blockWrap.style.maxHeight='none';
    blockWrap.style.whiteSpace='normal';
    blockWrap.style.flexDirection='row';
    blockWrap.style.alignItems='flex-start';
    blockWrap.style.gap='6px';
    blockWrap.style.pointerEvents='none';

    const main = document.createElement('div');
    main.className='hover-tip-main';
    const t = document.createElement('div');
    t.className='tip-title';
    const titleLeft = document.createElement('div');
    titleLeft.className='tip-title-left';
    const baseTitle = document.createElement('span');
    baseTitle.className='tip-title-base';
    baseTitle.textContent=blockInfo.title;
    titleLeft.appendChild(baseTitle);
    if(blockInfo.property) titleLeft.appendChild(createTooltipPill(blockInfo.property, 'property'));
    if(blockInfo.enhancement) titleLeft.appendChild(createTooltipPill(blockInfo.enhancement, 'enhancement'));
    if(blockInfo.core) titleLeft.appendChild(createTooltipPill(blockInfo.core, 'core'));
    t.appendChild(titleLeft);
    const levelEl=document.createElement('span');
    levelEl.className='tip-level';
    levelEl.textContent=`Lv.${blockInfo.level}`;
    levelEl.style.color=levelColor(blockInfo.level);
    t.appendChild(levelEl);
    main.appendChild(t);
    blockInfo.lines.forEach(line=>{
      const d=document.createElement('div');
      if(typeof line==='string') d.textContent=line;
      else { d.textContent=line.text; d.style.color=line.color; }
      main.appendChild(d);
    });
    blockWrap.appendChild(main);

    if(blockInfo.property || blockInfo.enhancement || blockInfo.core){
      const details=document.createElement('div');
      details.className='hover-tip-details';
      if(blockInfo.property) details.appendChild(createTooltipDetail(blockInfo.property, 'property'));
      if(blockInfo.enhancement) details.appendChild(createTooltipDetail(blockInfo.enhancement, 'enhancement'));
      if(blockInfo.core) details.appendChild(createTooltipDetail(blockInfo.core, 'core'));
      blockWrap.appendChild(details);
    }
    hoverTipEl.appendChild(blockWrap);
  }

  const lockPanel=document.createElement('div');
  lockPanel.className='locked-tooltip-main';
  const lockTitle=document.createElement('div');
  lockTitle.className='locked-tooltip-title';
  lockTitle.textContent='Ô khóa';
  const lockDesc=document.createElement('div');
  lockDesc.className='locked-tooltip-desc';
  lockDesc.textContent='Khối được đặt vào ô này sẽ bị khóa và không thể kéo hoặc xoay cho đến khi qua màn.';
  lockPanel.appendChild(lockTitle);
  lockPanel.appendChild(lockDesc);
  hoverTipEl.appendChild(lockPanel);

  hoverTipEl.classList.remove('hidden');
  placeHoverTip(targetEl);
}

function lockedCellTooltip(el){
  el.addEventListener('mouseenter', ()=>{
    const r=+el.dataset.r, c=+el.dataset.c;
    const block=state?.cells?.[r]?.[c]?.block || null;
    showLockedCellHoverTip(el, block);
  });
  el.addEventListener('mouseleave', hideHoverTip);
}

function showDebuffCellHoverTip(targetEl, block){
  hoverTipEl._targetEl=targetEl;
  hoverTipEl.innerHTML='';
  hoverTipEl.classList.remove('locked-tooltip-stack','hazard-tooltip');
  hoverTipEl.classList.add('debuff-tooltip-stack');

  if(block){
    const info=blockTooltip(block);
    const main=document.createElement('div');
    main.className='hover-tip-main';
    const title=document.createElement('div');
    title.className='tip-title';
    const left=document.createElement('div');
    left.className='tip-title-left';
    const base=document.createElement('span');
    base.className='tip-title-base';
    base.textContent=info.title;
    left.appendChild(base);
    if(info.property) left.appendChild(createTooltipPill(info.property,'property'));
    if(info.enhancement) left.appendChild(createTooltipPill(info.enhancement,'enhancement'));
    title.appendChild(left);
    const lv=document.createElement('span');
    lv.className='tip-level';
    lv.textContent=`Lv.${info.level}`;
    lv.style.color=levelColor(info.level);
    title.appendChild(lv);
    main.appendChild(title);
    info.lines.forEach(line=>{
      const d=document.createElement('div');
      if(typeof line==='string') d.textContent=line;
      else { d.textContent=line.text; d.style.color=line.color; }
      main.appendChild(d);
    });
    hoverTipEl.appendChild(main);
    if(info.property || info.enhancement){
      const details=document.createElement('div');
      details.className='hover-tip-details';
      if(info.property) details.appendChild(createTooltipDetail(info.property,'property'));
      if(info.enhancement) details.appendChild(createTooltipDetail(info.enhancement,'enhancement'));
      hoverTipEl.appendChild(details);
    }
  }

  const panel=document.createElement('div');
  panel.className='debuff-tooltip-main';
  const title=document.createElement('div');
  title.className='debuff-tooltip-title';
  title.textContent='Ô debuff';
  const desc=document.createElement('div');
  desc.className='debuff-tooltip-desc';
  desc.textContent='Khối được đặt vào ô này bị vô hiệu hóa toàn bộ hiệu ứng của khối và không tăng điểm khi bóng đi qua khối.';
  panel.appendChild(title);
  panel.appendChild(desc);
  hoverTipEl.appendChild(panel);

  hoverTipEl.classList.remove('hidden');
  placeHoverTip(targetEl);
}

function debuffCellTooltip(el){
  el.addEventListener('mouseenter', ()=>{
    const r=+el.dataset.r, c=+el.dataset.c;
    const block=state?.cells?.[r]?.[c]?.block || null;
    showDebuffCellHoverTip(el, block);
  });
  el.addEventListener('mouseleave', hideHoverTip);
}

function renderBlockCell(el, r, c, block){
  renderBlockArms(el, block);
  attachBoardBlockDrag(el);
  if(state.targeting && targetMatchesDef(state.targeting.def, block, 'block')){
    el.classList.add('targetable');
    if(state.targeting.targets.some(t=>t.obj===block)) el.classList.add('target-selected');
  }
  // A freshly placed block gets exactly one place-in animation, including
  // when it is placed onto a locked cell. The class is removed after the
  // animation so later renders/lock feedback can never replay it.
  if(placeAnimCell && placeAnimCell.r===r && placeAnimCell.c===c){
    el.classList.add('just-placed');
    const visual = el.querySelector('.block-visual');
    if(visual){
      visual.style.setProperty('--place-deg', (block.rotation*90)+'deg');
      setTimeout(()=>el.classList.remove('just-placed'), scaledDuration(360));
    }
  }
}

function renderBoardCell(r, c, boardReveal, boardHide){
  const cellData = state.cells[r][c];
  const el = document.createElement('div');
  el.dataset.r=r; el.dataset.c=c;
  el.className = 'cell ' + cellData.type + (cellData.block ? ' hasblock' : '') + (cellData.locked ? ' locked-cell' : '') + (cellData.debuff ? ' debuff-cell' : '');
  applyBoardCellAnimation(el, r, c, boardReveal, boardHide);

  if(cellData.type==='node'){
    renderNodeCell(el);
  } else if(cellData.type==='hole'){
    renderHoleCell(el, r, c);
  } else if(cellData.type==='black'){
    renderBlackCell(el);
  } else if(cellData.block){
    renderBlockCell(el, r, c, cellData.block);
  }

  if(cellData.locked){
    renderLockIcon(el, !!cellData.block);
    lockedCellTooltip(el);
  }
  if(cellData.debuff){
    const x=document.createElement('div');
    x.className='cell-debuff-x ' + (cellData.block ? 'debuff-x-filled' : 'debuff-x-empty');
    el.appendChild(x);
    debuffCellTooltip(el);
  }
  boardEl.appendChild(el);
}


// Runtime-only visual feedback for debuff cells.
function pulseDebuffBlock(cellEl){
  if(!cellEl || !cellEl.classList.contains('debuff-cell') || !cellEl.classList.contains('hasblock')) return;
  const visual = cellEl.querySelector('.block-visual');
  if(!visual) return;
  cellEl.classList.remove('debuff-block-feedback');
  void cellEl.offsetWidth;
  cellEl.classList.add('debuff-block-feedback');
  setTimeout(()=>{
    if(cellEl.isConnected) cellEl.classList.remove('debuff-block-feedback');
  }, scaledDuration(380));
}

function renderBoardSwapAnimation(){
  if(!swapAnim) return;
  const anim=swapAnim;
  swapAnim=null;
  requestAnimationFrame(()=>{
    const sourceEl=boardEl.querySelector(`.cell[data-r="${anim.source.r}"][data-c="${anim.source.c}"]`);
    const targetEl=boardEl.querySelector(`.cell[data-r="${anim.target.r}"][data-c="${anim.target.c}"]`);
    if(sourceEl&&targetEl){
      const sFrom=anim.sourceRect, sTo=anim.targetRect, tFrom=anim.targetRect, tTo=anim.sourceRect;
      const sVis=sourceEl.querySelector('.block-visual'), tVis=targetEl.querySelector('.block-visual');
      if(sVis){ sVis.style.setProperty('--from-x', `${sFrom.left-sTo.left}px`); sVis.style.setProperty('--from-y', `${sFrom.top-sTo.top}px`); sVis.style.setProperty('--block-deg', `${(state.cells[anim.source.r][anim.source.c].block.rotation||0)*90}deg`); sVis.style.animation='blockMoveIn calc(.34s / var(--anim-speed)) cubic-bezier(.22,.8,.24,1)'; }
      if(tVis){ tVis.style.setProperty('--from-x', `${tFrom.left-tTo.left}px`); tVis.style.setProperty('--from-y', `${tFrom.top-tTo.top}px`); tVis.style.setProperty('--block-deg', `${(state.cells[anim.target.r][anim.target.c].block.rotation||0)*90}deg`); tVis.style.animation='blockMoveIn calc(.34s / var(--anim-speed)) cubic-bezier(.22,.8,.24,1)'; }
    }
  });
}

function scheduleBoardAnimation(boardReveal, boardHide, revealToken, handRowEl){
  if(!boardReveal && !boardHide) return;
  const duration = ((state.rows * state.cols - 1) * 24 + 220) / animationSpeed;
  boardRevealTimer = setTimeout(()=>{
    if(revealToken !== boardRevealToken) return;
    if(boardReveal){
      boardEl.classList.remove('board-reveal-running');
      boardEl.classList.add('board-reveal-complete');
      state._boardReveal = false;
      state._handReveal = false;
      handRowEl?.classList.remove('hand-ui-reveal');
    } else {
      boardEl.classList.remove('board-hide-running');
      state._boardHide = false;
      state._handHide = false;
      handRowEl?.classList.remove('hand-ui-hide');
      if(typeof state._boardHideComplete === 'function') state._boardHideComplete();
    }
    boardRevealTimer = null;
  }, Math.max(0, duration));
}

function renderBoard(boardReveal, boardHide, revealToken){
  prepareBoardRender(boardReveal);

  // The board DOM is rebuilt on every render. Remember old debuff occupancy
  // so the X animates only when a block is actually added/removed.
  const previousDebuffBlocks = new Map();
  boardEl.querySelectorAll('.cell.debuff-cell').forEach(el=>{
    previousDebuffBlocks.set(`${el.dataset.r},${el.dataset.c}`, el.classList.contains('hasblock'));
  });

  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${state.rows}, 1fr)`;
  boardWrapEl.style.aspectRatio = `${state.cols} / ${state.rows}`;
  boardEl.innerHTML = '';

  for(let r=0;r<state.rows;r++){
    for(let c=0;c<state.cols;c++) renderBoardCell(r, c, boardReveal, boardHide);
  }

  if(!boardReveal && !boardHide){
    for(const [key, hadBlock] of previousDebuffBlocks){
      const [r,c] = key.split(',').map(Number);
      const cellData = state.cells?.[r]?.[c];
      if(!cellData?.debuff) continue;

      const hasBlock = !!cellData.block;
      const cellEl = boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      const x = cellEl?.querySelector('.cell-debuff-x');
      if(!cellEl || !x) continue;

      if(!hadBlock && hasBlock){
        x.classList.add('debuff-x-grow');
      }else if(hadBlock && !hasBlock){
        x.classList.add('debuff-x-shrink');
      }
    }
  }

  renderBoardSwapAnimation();
  placeAnimCell = null;
}
function renderHUD(){
  bagCountEl.textContent = `Túi khối còn lại: ${formatNumber(state.bag.length)}`;
  discardCountEl.textContent = `(${formatNumber(state.discardsLeft)}/${formatNumber(getMaxDiscards())})`;
  discardBtnEl.disabled = state.discardsLeft<=0 || !state.hand.some(Boolean) || state.resolving || state.phase!=='playing' || !!state.targeting;
  scoreValEl.textContent = formatNumber(state.score);
  targetValEl.textContent = formatNumber(state.target);
  moneyValEl.textContent = formatMoney(state.money);
  levelValEl.textContent = formatNumber(state.level);
}

function render(){
  hideHoverTip();
  const boardReveal = !!state._boardReveal;
  const boardHide = !!state._boardHide;
  const revealToken = ++boardRevealToken;
  if(boardRevealTimer){
    clearTimeout(boardRevealTimer);
    boardRevealTimer = null;
  }

  boardEl.classList.toggle('board-reveal-running', boardReveal || boardHide);
  boardEl.classList.toggle('board-hide-running', boardHide);

  const handRowEl = document.querySelector('.hand-row');
  const handReveal = !!state._handReveal && boardReveal;
  const handHide = !!state._handHide && boardHide;
  handRowEl?.classList.toggle('hand-ui-reveal', handReveal);
  handRowEl?.classList.toggle('hand-ui-hide', handHide);
  handRowEl?.classList.toggle('reward-hidden', !!state._handRewardHidden || state.phase==='shop' || state.phase==='reward');
  boardEl.classList.remove('board-reveal-complete');

  renderBoard(boardReveal, boardHide, revealToken);
  handRowEl?.style.setProperty('--hand-delay-last', `${Math.max(0,getMaxHandSize()-1)*24}ms`);
  renderHand();
  scheduleBoardAnimation(boardReveal, boardHide, revealToken, handRowEl);
  renderBallQueue();
  renderCardHand();
  renderHUD();
  refreshAnimSlots.clear();
}

function renderHand(){
  handEl.innerHTML = '';
  for(let i=0;i<getMaxHandSize();i++){
    const slot = document.createElement('div');
    slot.style.setProperty('--hand-delay', `${i*24}ms`);
    const block = state.hand[i];
    slot.className = 'hand-slot' + (block ? ' filled' : ' empty-slot');
    slot.dataset.idx = i;
    if(block){
      renderBlockArms(slot, block);
      if(refreshAnimSlots.has(i)) slot.classList.add('just-refreshed');
      attachHandBlockDrag(slot, i);
      if(state.targeting && targetMatchesDef(state.targeting.def, block, 'block')){
        slot.classList.add('targetable');
        if(state.targeting.targets.some(t=>t.obj===block)) slot.classList.add('target-selected');
      }
    }
    handEl.appendChild(slot);
  }
}

function syncBallPoolFromQueue(){
  const byId = new Map(state.ballPool.map(b=>[b._id,b]));
  const ordered = [];
  for(const q of state.ballQueue){
    const b = byId.get(q._id);
    if(!b) continue;
    b.property = q.property || null;
    b.enhancement = q.enhancement || null;
    ordered.push(b);
  }
  if(ordered.length===state.ballPool.length) state.ballPool = ordered;
}

function syncBallMutationTargets(targets){
  const ballTargets = (targets||[]).filter(t=>t.kind==='ball').map(t=>t.obj).filter(Boolean);
  if(!ballTargets.length) return;

  // Sync by stable ball _id rather than object identity. Some game flows can
  // rebuild/reorder state.ballPool or state.ballQueue, so comparing object
  // references can miss a mutation even when it is the same logical ball.
  const changedById = new Map();
  ballTargets.forEach(ball=>{
    if(!ball._id) return;
    changedById.set(ball._id, {
      property: ball.property || null,
      enhancement: ball.enhancement || null,
    });
  });

  state.ballPool.forEach(ball=>{
    const changed = changedById.get(ball._id);
    if(!changed) return;
    ball.property = changed.property;
    ball.enhancement = changed.enhancement;
  });

  state.ballQueue.forEach(q=>{
    const changed = changedById.get(q._id);
    if(!changed) return;
    q.property = changed.property;
    q.enhancement = changed.enhancement;
  });

  renderBallQueue();
  refreshOpenShop();
  refreshOpenGachaBalls();
}

function syncBallQueueFromPool(){
  ensureBallIds();
  const firedIds = new Set(state.ballQueue.filter(b=>b.fired).map(b=>b._id));
  const unfired = state.ballPool.filter(b=>!firedIds.has(b._id));
  let u=0;
  state.ballQueue = state.ballQueue.map(q=>{
    if(q.fired) return q;
    const b=unfired[u++];
    return {_id:b._id, fired:false, property:b.property||null, enhancement:b.enhancement||null};
  });
}

let ballClickSelection = null;
let suppressBallClickUntil = 0;

function clearBallClickSelection(){
  ballClickSelection = null;
  ballQueueEl.querySelectorAll('.ball-chip.click-selected').forEach(el=>el.classList.remove('click-selected'));
}

function handleBallQueueClick(idx){
  if(state.targeting || state.resolving || (state.phase!=='playing' && state.phase!=='shop')) return;
  const ball = state.ballQueue[idx];
  if(!ball || ball.fired || idx < state.ballsFired) return;

  const chip = [...ballQueueEl.children][idx];
  if(ballClickSelection===null){
    ballClickSelection = idx;
    chip?.classList.add('click-selected');
    return;
  }

  if(ballClickSelection===idx){
    clearBallClickSelection();
    return;
  }

  const sourceIdx = ballClickSelection;
  const targetIdx = idx;
  const sourceEl = [...ballQueueEl.children][sourceIdx];
  const targetEl = [...ballQueueEl.children][targetIdx];
  const sourceRect = sourceEl?.getBoundingClientRect();
  const targetRect = targetEl?.getBoundingClientRect();

  [state.ballQueue[sourceIdx], state.ballQueue[targetIdx]] = [state.ballQueue[targetIdx], state.ballQueue[sourceIdx]];
  syncBallPoolFromQueue();
  clearBallClickSelection();

  if(sourceRect && targetRect){
    ballSwapAnim={source:sourceIdx,target:targetIdx,sourceRect,targetRect};
  }
  renderBallQueue();
}

function renderBallQueue(){
  ballQueueEl.innerHTML = '';
  state.ballQueue.forEach((b, i)=>{
    const chip = document.createElement('div');
    chip.className = 'ball-chip' + (b.fired ? ' fired' : '');
    chip.dataset.ballIndex = i;
    if(b.property) chip.style.setProperty('--prop-color', PROP_COLOR[b.property]);
    if(b.property) chip.dataset.prop = b.property;
    if(b.enhancement) chip.dataset.enh = b.enhancement;
    chip.textContent = '';
    markDebugTarget(chip, b, 'ball');

    attachObjectTooltip(chip, b, 'ball');

    if(!b.fired && state.targeting && targetKindMatches(state.targeting.def, 'ball')){
      chip.classList.add('targetable');
      chip.addEventListener('click', ()=> handleTargetClick({obj:b, kind:'ball'}));
    }
    if(!b.fired && !state.targeting){
      chip.addEventListener('click', ()=>{
        if(performance.now() < suppressBallClickUntil) return;
        handleBallQueueClick(i);
      });
    }
    if(!b.fired) attachBallDrag(chip, i);
    ballQueueEl.appendChild(chip);
  });
  if(ballSwapAnim){
    const anim=ballSwapAnim;
    ballSwapAnim=null;
    requestAnimationFrame(()=>{
      const sourceEl=[...ballQueueEl.children][anim.source];
      const targetEl=[...ballQueueEl.children][anim.target];
      if(!sourceEl || !targetEl) return;
      const sourceRect=sourceEl.getBoundingClientRect();
      const targetRect=targetEl.getBoundingClientRect();
      const sx=anim.sourceRect.left-sourceRect.left, sy=anim.sourceRect.top-sourceRect.top;
      const tx=anim.targetRect.left-targetRect.left, ty=anim.targetRect.top-targetRect.top;
      sourceEl.style.setProperty('--from-x',`${sx}px`);
      sourceEl.style.setProperty('--from-y',`${sy}px`);
      sourceEl.style.animation='ballMoveIn calc(.34s / var(--anim-speed)) cubic-bezier(.22,.8,.24,1)';
      targetEl.style.setProperty('--from-x',`${tx}px`);
      targetEl.style.setProperty('--from-y',`${ty}px`);
      targetEl.style.animation='ballMoveIn calc(.34s / var(--anim-speed)) cubic-bezier(.22,.8,.24,1)';
    });
  }
}

let ballDrag = null;
let ballSwapAnim = null;

function attachBallDrag(chip, idx){
  chip.addEventListener('pointerdown', e=>{
    if(state.targeting){ e.preventDefault(); return; }
    if(state.resolving || (state.phase!=='playing' && state.phase!=='shop')) return;
    if(idx < state.ballsFired || state.ballQueue[idx].fired) return;
    startBallDrag(e, idx);
  });
}

function startBallDrag(e, idx){
  e.preventDefault();
  ballDrag={idx,startX:e.clientX,startY:e.clientY,targetX:e.clientX,targetY:e.clientY,moved:false,ghostEl:null,sourceEl:null,curX:e.clientX,curY:e.clientY};
  window.addEventListener('pointermove', onBallDragMove);
  window.addEventListener('pointerup', onBallDragEnd);
}

function onBallDragMove(e){
  if(!ballDrag) return;
  ballDrag.targetX=e.clientX; ballDrag.targetY=e.clientY;
  const dx=e.clientX-ballDrag.startX, dy=e.clientY-ballDrag.startY;
  if(!ballDrag.moved && Math.hypot(dx,dy)>6){
    ballDrag.moved=true;
    suppressBallClickUntil = performance.now() + 120;
    ballDrag.sourceEl=ballQueueEl.querySelector(`.ball-chip[data-ball-index=\"${ballDrag.idx}\"]`);
    if(!ballDrag.sourceEl){
      ballDrag.sourceEl=[...ballQueueEl.children][ballDrag.idx];
    }
    ballDrag.ghostEl=document.createElement('div');
    ballDrag.ghostEl.className='ball-drag-ghost';
    ballDrag.ghostEl.innerHTML=ballChipMarkup(state.ballQueue[ballDrag.idx]);
    document.body.appendChild(ballDrag.ghostEl);
    if(ballDrag.sourceEl) ballDrag.sourceEl.classList.add('drag-source-fade');
    ballDrag.curX=e.clientX; ballDrag.curY=e.clientY;
    dragGhostLoop(ballDrag);
  }
  if(ballDrag.moved) updateBallDropHover(e.clientX,e.clientY);
}


function updateBallDropHover(x,y){
  ballQueueEl.querySelectorAll('.ball-drop-hover').forEach(el=>el.classList.remove('ball-drop-hover'));
  const el=document.elementFromPoint(x,y)?.closest?.('.ball-chip');
  if(!el || el.classList.contains('fired')) return;
  const targetIdx=[...ballQueueEl.children].indexOf(el);
  if(targetIdx>=state.ballsFired && targetIdx!==ballDrag.idx) el.classList.add('ball-drop-hover');
}


function onBallDragEnd(e){
  window.removeEventListener('pointermove', onBallDragMove);
  window.removeEventListener('pointerup', onBallDragEnd);
  if(!ballDrag) return;
  if(ballDrag.raf) cancelAnimationFrame(ballDrag.raf);

  const info=ballDrag;
  ballDrag=null;
  ballQueueEl.querySelectorAll('.ball-drop-hover').forEach(el=>el.classList.remove('ball-drop-hover'));

  if(!info.moved){
    info.sourceEl?.classList.remove('drag-source-fade');
    info.ghostEl?.remove();
    return;
  }

  const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.ball-chip');
  const targetIdx=el ? [...ballQueueEl.children].indexOf(el) : -1;
  const sourceIdx=info.idx;
  if(targetIdx>=state.ballsFired && targetIdx!==sourceIdx && !state.ballQueue[targetIdx].fired){
    const sourceRect=info.sourceEl?.getBoundingClientRect();
    const targetEl=[...ballQueueEl.children][targetIdx];
    const targetRect=targetEl?.getBoundingClientRect();
    [state.ballQueue[sourceIdx], state.ballQueue[targetIdx]]=[state.ballQueue[targetIdx],state.ballQueue[sourceIdx]];
    syncBallPoolFromQueue();
    info.sourceEl?.classList.remove('drag-source-fade');
    info.ghostEl?.remove();
    if(sourceRect && targetRect) ballSwapAnim={source:sourceIdx,target:targetIdx,sourceRect,targetRect};
    renderBallQueue();
    return;
  }
  animateDragReturn(info);
}

function getCardSellPrice(def){
  return Math.floor((Number(def?.cost)||0) / 2);
}

function renderCardHand(){
  cardHandEl.innerHTML = '';
  if(!state.cardHand.length){
    cardHandEl.innerHTML = '<div class="tag-empty">Chưa có thẻ nào trong tay</div>';
    return;
  }
  state.cardHand.forEach((card, idx)=>{
    const isUpgrade = card.kind==='upgrade';
    const def = isUpgrade ? UPGRADE_POOL.find(x=>x.id===card.defId) : POWER_CARD_DEFS[card.defId];
    if(!def) return;
    const chip = document.createElement('div'); chip.className='power-card-chip';
    const nameSpan = document.createElement('span'); nameSpan.className='name'; nameSpan.textContent = def.name;
    attachCardTooltip(chip, def);

    const actions = document.createElement('div'); actions.className='card-actions';
    const btn = document.createElement('button'); btn.textContent='Dùng';
    btn.disabled = !['playing','shop'].includes(state.phase) || !!state.targeting;
    btn.addEventListener('click', ()=> activateCardFromHand(idx, def));

    const sellPrice = getCardSellPrice(def);
    const sellBtn = document.createElement('button');
    sellBtn.className='sell-card-btn';
    sellBtn.textContent=`Bán ${formatMoney(sellPrice)}`;
    sellBtn.disabled = !['playing','shop'].includes(state.phase) || !!state.targeting || sellPrice<=0;
    sellBtn.addEventListener('click', ()=>{
      if(!['playing','shop'].includes(state.phase) || state.targeting || sellPrice<=0) return;
      state.cardHand.splice(idx,1);
      state.money += sellPrice;
      moneyValEl.textContent=formatMoney(state.money);
      render();
      renderTargetBanner();
      scheduleAutoSave();
    });

    actions.appendChild(btn);
    actions.appendChild(sellBtn);
    chip.appendChild(nameSpan);
    chip.appendChild(actions);
    cardHandEl.appendChild(chip);
  });
}

