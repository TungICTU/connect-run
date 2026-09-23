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
const locationBarEl = document.getElementById('locationBar');
let refreshAnimSlots = new Set();
let boardRevealTimer = null;
let boardRevealToken = 0;
discardBtnEl.addEventListener('click', discardHand);
let placeAnimCell = null; // {r,c} of the block placed by the most recent drop, for the pop-in animation
let swapAnim = null; // {source:{r,c},target:{r,c}} for two-block movement animation

function getBoardCellTintColor(container, block=null){
  const hazard=typeof getBlockTooltipHazard==='function' ? getBlockTooltipHazard(block,container) : null;
  return hazard?.color || null;
}

function appendBlockCellTint(element, color){
  if(!element || !color) return;
  const tint=document.createElement('span');
  tint.className='block-cell-tint';
  tint.style.setProperty('--cell-tint', color);
  element.appendChild(tint);
}

function renderBlockArms(container, block, options={}){
  container.querySelectorAll('.block-visual, .block-core-dot, .boss-hidden-block, .boss-silenced-x, .boss-block-nerf-indicator').forEach(n=>n.remove());

  if(block.bossHidden){
    const hidden=document.createElement('div');
    hidden.className='boss-hidden-block';
    hidden.textContent='?';
    container.appendChild(hidden);
    markDebugTarget(container, block, 'block');
    container.addEventListener('mouseenter', ()=> showHoverTip(container, {title:'Khối ẩn',level:1,lines:['Khối này đang bị The Illusioner che giấu. Đặt lên bảng để lộ hình dạng.']}));
    container.addEventListener('mouseleave', hideHoverTip);
    return;
  }

  const visual = document.createElement('div'); visual.className='block-visual';
  if(block.property) visual.dataset.prop = block.property;
  if(block.enhancement) visual.dataset.enh = block.enhancement;
  const deg = block.rotation*90;
  visual.dataset.deg = deg;
  visual.style.setProperty('--block-base-rotation', `${deg}deg`);
  visual.style.transform = `rotate(${deg}deg)`;
  const cellTint=getBoardCellTintColor(container, block);
  const hub = document.createElement('div'); hub.className='hub';
  appendBlockCellTint(hub, cellTint);
  visual.appendChild(hub);
  BASE_SIDES[block.type].forEach(side=>{
    const arm = document.createElement('div');
    arm.className = 'arm arm-' + DIR_NAMES[side];
    appendBlockCellTint(arm, cellTint);
    visual.appendChild(arm);
  });
  container.appendChild(visual);

  if(block.core && CORE_DEFS[block.core.id]){
    const coreDot=document.createElement('div');
    coreDot.className='block-core-dot';
    coreDot.dataset.core=block.core.id;
    coreDot._coreBlock = block;
    if(coreHasCount(block.core)) coreDot.textContent=String(getCoreDisplayCount(block));
    container.appendChild(coreDot);
  }

  if(block.bossSilenced){
    const x=document.createElement('div');
    x.className='boss-silenced-x';
    container.appendChild(x);
  }

  if(getCurrentBossTypeReduction(block)<1){
    const nerf=document.createElement('div');
    nerf.className='boss-block-nerf-indicator';
    nerf.textContent='≫';
    nerf.title='Boss giảm 50% hiệu ứng của khối này';
    container.appendChild(nerf);
  }

  markDebugTarget(container, block, 'block');
  if(block.property) container.style.setProperty('--prop-color', PROP_COLOR[block.property]);
  if(block.enhancement) container.style.setProperty('--enh-color', ENH_COLOR[block.enhancement]);
  if(!options.suppressTooltip){
    container.addEventListener('mouseenter', ()=>{
      const info=blockTooltip(block,container);
      const hazards=typeof getTooltipHazardEntries==='function' ? getTooltipHazardEntries(block,container) : [];
      info.__hazards=hazards;
      showObjectTooltip(container,info,hazards);
    });
    container.addEventListener('mouseleave', hideHoverTip);
  }
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

function showCellHazardHoverTip(targetEl, block, titleText, bodyText, color, extraClass='cell-hazard-tooltip-stack'){
  const info=block ? blockTooltip(block,targetEl) : null;
  const hazards=[];
  if(block && typeof getTooltipHazardEntries==='function'){
    hazards.push(...getTooltipHazardEntries(block,targetEl));
  } else if(titleText){
    hazards.push({id:'cell',title:titleText,desc:bodyText,color,className:extraClass});
  }
  // Keep cell tooltip first; getTooltipHazardEntries already orders it that way.
  // The caller-supplied fallback is only used when there is no block.
  if(block && titleText && !hazards.some(h=>h.title===titleText)){
    hazards.unshift({id:'cell',title:titleText,desc:bodyText,color,className:extraClass});
  }
  if(info){ info.__hazards=hazards; showObjectTooltip(targetEl,info,hazards); }
  else {
    showSimpleHoverTip(targetEl,titleText,bodyText,extraClass);
    hoverTipEl.style.setProperty('--tooltip-accent',color||'var(--cyan)');
    const main=hoverTipEl.querySelector('.hover-tip-main');
    if(main){ main.style.borderColor=color||'var(--cyan)'; main.style.boxShadow='0 4px 18px rgba(0,0,0,.30), 0 0 4px rgba(255,255,255,.055)'; }
  }
}
function lockedCellTooltip(el){
  el.addEventListener('mouseenter', ()=>{
    const r=+el.dataset.r, c=+el.dataset.c;
    const block=state?.cells?.[r]?.[c]?.block || null;
    showCellHazardHoverTip(el, block, 'Ô khóa', 'Khối được đặt vào ô này sẽ bị khóa và không thể kéo hoặc xoay cho đến khi qua màn.', '#ff4f83', 'locked-tooltip-stack');
  });
  el.addEventListener('mouseleave', hideHoverTip);
}

function debuffCellTooltip(el){
  el.addEventListener('mouseenter', ()=>{
    const r=+el.dataset.r, c=+el.dataset.c;
    const block=state?.cells?.[r]?.[c]?.block || null;
    showCellHazardHoverTip(el, block, 'Ô debuff', 'Khối được đặt vào ô này bị vô hiệu hóa toàn bộ hiệu ứng của khối và không tăng điểm khi bóng đi qua khối.', '#ff5836', 'debuff-tooltip-stack');
  });
  el.addEventListener('mouseleave', hideHoverTip);
}

function renderBlockCell(el, r, c, block){
  const cell=state.cells?.[r]?.[c];
  const suppressTooltip=!!(cell?.locked || cell?.debuff || cell?.nerf || cell?.controlled || cell?.assassinTarget);
  renderBlockArms(el, block, {suppressTooltip});
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

function renderBossCellIndicators(el, r, c, cellData){
  if(isBossAssassinTarget(r,c) || cellData.assassinTarget){
    el.classList.add('boss-assassin-target');
    const icon=document.createElement('div');
    icon.className='boss-assassin-target-icon';
    icon.setAttribute('aria-hidden','true');
    el.appendChild(icon);
    attachBossHazardTooltip(el, 'Ô mục tiêu', 'Sau mỗi lần bắn, nếu có khối trong ô này thì khối sẽ bị triệt tiêu và ô mục tiêu biến mất.', '#8b1e3f', 'boss-assassin-tooltip');
  }

  if(cellData.nerf){
    const icon=document.createElement('div');
    icon.className='boss-nerf-cell-icon';
    icon.textContent='≫';
    el.appendChild(icon);
    attachBossHazardTooltip(el, 'Ô giảm sức mạnh', 'Khối trong ô này chỉ nhận 50% giá trị của các hiệu ứng bị giảm sức mạnh.', '#f7b267', 'boss-nerf-tooltip');
  }

  if(cellData.controlled){
    el.classList.add('boss-controlled-cell');
    const icon=document.createElement('div');
    icon.className='boss-controlled-icon';
    icon.textContent='↻';
    icon.style.color=BOSS_CONTROLLED_COLOR;
    el.appendChild(icon);
    attachBossHazardTooltip(el, 'Ô bị điều khiển', 'Trước mỗi lần bắn, khối trong ô này sẽ bị xoay về hướng ngẫu nhiên.', BOSS_CONTROLLED_COLOR, 'boss-controlled-tooltip');
  }
}

function attachBossHazardTooltip(el,title,desc,color,tooltipClass=''){
  el.addEventListener('mouseenter', ()=>{
    const r=+el.dataset.r, c=+el.dataset.c;
    const block=state?.cells?.[r]?.[c]?.block || null;
    showCellHazardHoverTip(el, block, title, desc, color, tooltipClass || 'cell-hazard-tooltip-stack');
  });
  el.addEventListener('mouseleave', hideHoverTip);
}

function renderBoardCell(r, c, boardReveal, boardHide){
  const cellData = state.cells[r][c];
  const el = document.createElement('div');
  el.dataset.r=r; el.dataset.c=c;
  markDebugCellTarget(el, cellData);
  el.className = 'cell ' + cellData.type + (cellData.block ? ' hasblock' : '') + (cellData.locked ? ' locked-cell' : '') + (cellData.debuff ? ' debuff-cell' : '') + (cellData.nerf ? ' nerf-cell' : '') + (cellData.controlled ? ' controlled-cell' : '');
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
  renderBossCellIndicators(el,r,c,cellData);
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
const LOCATION_STEP_WIDTH = 62;
const LOCATION_STEP_GAP = 4;
const LOCATION_STEP_DISTANCE = LOCATION_STEP_WIDTH + LOCATION_STEP_GAP;
const LOCATION_KEEP_AHEAD = 7;
const LOCATION_KEEP_BEHIND = 8;
let locationTransitionToken = 0;
let locationTransitionTimer = null;

function getLocationLevels(){
  const current=Math.max(1,Number(state?.level)||1);
  const persistedStart=Math.floor(Number(state?.locationBarFirstLevel));
  const start=Number.isFinite(persistedStart) ? Math.max(1,persistedStart) : Math.max(1,current-2);
  const end=current+4;
  const items=[];
  for(let level=start;level<=end;level++) items.push(level);
  return {current,start,end,items};
}

function ensureLocationCurrentArrow(){
  if(!locationBarEl) return null;
  let arrow=locationBarEl.querySelector('.location-current-arrow');
  if(!arrow){
    arrow=document.createElement('div');
    arrow.className='location-current-arrow';
    arrow.textContent='▼';
    arrow.setAttribute('aria-hidden','true');
    locationBarEl.appendChild(arrow);
  }
  return arrow;
}

function createLocationStep(level, current){
  const wrap=document.createElement('div');
  wrap.className='location-step';
  wrap.dataset.locationLevel=String(level);
  wrap.__debugLocationTarget={level};
  const boss=getBossDefForLevel?.(level) || null;
  const node=document.createElement('div');
  node.className='location-node' + (level===current ? ' current' : '') + (boss ? ' boss' : '');
  node.textContent=String(level);
  node.dataset.level=String(level);
  if(boss){
    node.style.setProperty('--boss-color',boss.color);
    node.dataset.boss=boss.id;
    node.addEventListener('mouseenter',()=>showBossHoverTip(node,boss));
    node.addEventListener('mouseleave',hideHoverTip);
  }
  wrap.appendChild(node);
  if(boss){
    const name=document.createElement('div');
    name.className='location-boss-name';
    name.textContent=boss.name;
    name.style.color=boss.color;
    wrap.appendChild(name);
  }
  return wrap;
}

function buildLocationTrack(current, options={}){
  const track=document.createElement('div');
  track.className='location-track';
  const persistedStart=Math.floor(Number(state?.locationBarFirstLevel));
  const startLevel=Number.isFinite(options.startLevel) ? Math.max(1,Math.floor(Number(options.startLevel)))
    : (Number.isFinite(persistedStart) ? Math.max(1,persistedStart) : Math.max(1,current-2));
  track.dataset.locationFirstLevel=String(startLevel);
  track.__locationFirstLevel=startLevel;
  if(state) state.locationBarFirstLevel=startLevel;
  try{ ensureBossHistoryThrough?.(Math.max(current+LOCATION_KEEP_AHEAD+2, Number(options.endLevel)||0)); }
  catch(err){ console.error('Location bar boss history generation failed:',err); }
  const start=track.__locationFirstLevel;
  const end=Math.max(current+LOCATION_KEEP_AHEAD,start+4,Number(options.endLevel)||0);
  for(let level=start;level<=end;level++) track.appendChild(createLocationStep(level,current));
  track.__locationTranslateX=-(current-start)*LOCATION_STEP_DISTANCE;
  track.style.transition='none';
  track.style.transform=`translate3d(${track.__locationTranslateX}px,0,0)`;
  track.style.left='calc(50% - 31px)';
  return track;
}

function findLocationStep(track,level){
  if(!track) return null;
  return track.querySelector(`.location-step[data-location-level="${level}"]`);
}

function getLocationFirstLevel(track){
  const n=Number(track?.dataset?.locationFirstLevel);
  return Number.isFinite(n) ? n : 1;
}

function setLocationFirstLevel(track,level){
  const n=Math.max(1,Math.floor(Number(level)||1));
  if(!track) return;
  track.__locationFirstLevel=n;
  track.dataset.locationFirstLevel=String(n);
  if(state) state.locationBarFirstLevel=n;
}

function getLocationTranslate(track){
  if(!track) return 0;
  if(Number.isFinite(track.__locationTranslateX)) return track.__locationTranslateX;
  const transform=getComputedStyle(track).transform;
  if(!transform || transform==='none') return 0;
  const matrix3d=transform.match(/matrix3d\(([^)]+)\)/);
  if(matrix3d){
    const parts=matrix3d[1].split(',').map(Number);
    return Number.isFinite(parts[12]) ? parts[12] : 0;
  }
  const matrix=transform.match(/matrix\(([^)]+)\)/);
  if(matrix){
    const parts=matrix[1].split(',').map(Number);
    return Number.isFinite(parts[4]) ? parts[4] : 0;
  }
  return 0;
}

function setLocationTranslate(track,x){
  if(!track) return;
  track.__locationTranslateX=Number(x)||0;
  track.style.transform=`translate3d(${track.__locationTranslateX}px,0,0)`;
}

function ensureLocationRightNodes(track,current){
  if(!track) return;
  let maxLevel=0;
  for(const step of track.querySelectorAll('.location-step')){
    maxLevel=Math.max(maxLevel,Number(step.dataset.locationLevel)||0);
  }
  const wanted=Math.max(current+LOCATION_KEEP_AHEAD,maxLevel);
  try{ ensureBossHistoryThrough?.(wanted+2); }
  catch(err){ console.error('Location bar Boss pre-roll failed:',err); }
  for(let level=maxLevel+1;level<=wanted;level++) track.appendChild(createLocationStep(level,current));
}

function normalizeLocationCurrentNode(track,current){
  if(!track) return false;
  let node=findLocationStep(track,current)?.querySelector('.location-node');
  if(!node) return false;
  track.querySelectorAll('.location-node.current').forEach(n=>n.classList.remove('current'));
  node.classList.add('current');
  return true;
}

function syncLocationTrackImmediate(track,current){
  if(!track) return false;
  ensureLocationRightNodes(track,current);
  if(!normalizeLocationCurrentNode(track,current)) return false;
  const first=getLocationFirstLevel(track);
  const translate=-(current-first)*LOCATION_STEP_DISTANCE;
  track.style.transition='none';
  track.style.left='calc(50% - 31px)';
  setLocationTranslate(track,translate);
  return true;
}

function removeFarOutsideLocationSteps(track){
  if(!track || !locationBarEl) return 0;
  const barRect=locationBarEl.getBoundingClientRect();
  const current=Math.max(1,Number(state?.level)||1);
  let removed=0;
  const steps=[...track.querySelectorAll('.location-step')];
  for(const step of steps){
    const level=Number(step.dataset.locationLevel)||0;
    if(level>=current-LOCATION_KEEP_BEHIND) continue;
    const rect=step.getBoundingClientRect();
    // Only recycle a step after it is safely and completely outside the bar.
    // The extra margin prevents border/mask/sub-pixel changes from recycling a
    // step at the exact visible edge.
    if(rect.right < barRect.left-2){
      step.remove();
      removed++;
    }
  }
  if(removed){
    setLocationFirstLevel(track, getLocationFirstLevel(track)+removed);
    setLocationTranslate(track, getLocationTranslate(track)+removed*LOCATION_STEP_DISTANCE);
    // Keep the persisted rail position in sync with what is actually visible.
    // This matters when the player leaves/reloads immediately after a transition.
    scheduleAutoSave?.();
  }
  return removed;
}

function cancelLocationTransition(){
  locationTransitionToken++;
  if(locationTransitionTimer){
    clearTimeout(locationTransitionTimer);
    locationTransitionTimer=null;
  }
  const track=locationBarEl?.querySelector('.location-track');
  if(track){
    // Freeze exactly where the persistent rail is. Never clear/rebuild it here.
    const x=getLocationTranslate(track);
    track.style.transition='none';
    setLocationTranslate(track,x);
  }
}

function replaceLocationTrackSafely(current){
  if(!locationBarEl) return null;
  const old=locationBarEl.querySelector('.location-track');
  const persistedStart=Math.floor(Number(state?.locationBarFirstLevel));
  const startLevel=Number.isFinite(persistedStart) ? Math.max(1,persistedStart) : Math.max(1,current-2);
  const next=buildLocationTrack(current,{startLevel});
  // Insert first; never leave the bar empty even for one layout/frame.
  if(old) old.replaceWith(next);
  else locationBarEl.appendChild(next);
  return next;
}

function renderLocationBar(animate=false){
  if(!locationBarEl || !state) return;
  const current=Math.max(1,Number(state.level)||1);
  if(current===1 && !Number.isFinite(Number(state.locationBarFirstLevel))) state.locationBarFirstLevel=1;
  ensureLocationCurrentArrow();

  let track=locationBarEl.querySelector('.location-track');
  if(!track){
    track=replaceLocationTrackSafely(current);
    syncLocationTrackImmediate(track,current);
    return;
  }

  const oldCurrent=Number(track.querySelector('.location-node.current')?.dataset.level)||0;
  const sequential=animate && oldCurrent===current-1;

  if(!sequential){
    cancelLocationTransition();
    if(!syncLocationTrackImmediate(track,current)){
      track=replaceLocationTrackSafely(current);
      syncLocationTrackImmediate(track,current);
    }
    return;
  }

  cancelLocationTransition();
  const token=locationTransitionToken;
  ensureLocationRightNodes(track,current);
  if(!normalizeLocationCurrentNode(track,current)){
    syncLocationTrackImmediate(track,current);
    return;
  }

  const currentX=getLocationTranslate(track);
  const targetX=currentX-LOCATION_STEP_DISTANCE;
  track.style.transition='transform calc(.46s / var(--anim-speed)) cubic-bezier(.22,.8,.24,1)';

  requestAnimationFrame(()=>{
    if(token!==locationTransitionToken || !track.isConnected) return;
    setLocationTranslate(track,targetX);
  });

  locationTransitionTimer=setTimeout(()=>{
    if(token!==locationTransitionToken || !track.isConnected){
      locationTransitionTimer=null;
      return;
    }
    track.style.transition='none';
    setLocationTranslate(track,targetX);

    // Keep the visible portion untouched. Recycling can only happen after a
    // node is safely outside the viewport; the remaining rail compensates by
    // exactly the same number of fixed 66px steps.
    removeFarOutsideLocationSteps(track);
    ensureLocationRightNodes(track,current);
    locationTransitionTimer=null;
  },scaledDuration(500));
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

