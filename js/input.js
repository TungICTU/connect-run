// ---------- drag & rotate ----------
let drag = null;

function attachHandBlockDrag(slot, idx){
  slot.addEventListener('pointerdown', e=>{
    if(state.targeting){ e.preventDefault(); handleTargetClick({obj: state.hand[idx], kind:'block'}); return; }
    if(state.resolving || state.phase!=='playing') return;
    startDrag(e, {origin:'hand', idx, block: state.hand[idx]});
  });
}
function pulseLockedBlock(cellEl){
  if(!cellEl) return;
  cellEl.classList.remove('locked-block-feedback');
  void cellEl.offsetWidth;
  cellEl.classList.add('locked-block-feedback');
  clearTimeout(cellEl._lockedFeedbackTimer);
  cellEl._lockedFeedbackTimer=setTimeout(()=>cellEl.classList.remove('locked-block-feedback'), scaledDuration(460));
}

function attachBoardBlockDrag(cellEl){
  cellEl.addEventListener('pointerdown', e=>{
    const r=+cellEl.dataset.r, c=+cellEl.dataset.c;
    if(state.targeting){ e.preventDefault(); handleTargetClick({obj: state.cells[r][c].block, kind:'block'}); return; }
    if(state.resolving || state.phase!=='playing') return;
    if(state.cells[r]?.[c]?.locked && !blockIgnoresCellHazards(state.cells[r][c]?.block)){
      e.preventDefault();
      pulseLockedBlock(cellEl);
      return;
    }
    startDrag(e, {origin:'board', r, c, block: state.cells[r][c].block});
  });
}
function startDrag(e, info){
  e.preventDefault();
  drag = Object.assign(info, {startX:e.clientX, startY:e.clientY, moved:false, ghostEl:null});
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
}
function onDragMove(e){
  if(!drag) return;
  drag.targetX = e.clientX; drag.targetY = e.clientY;
  const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY;
  if(!drag.moved && Math.hypot(dx,dy)>6){
    drag.moved = true;
    drag.ghostEl = document.createElement('div'); drag.ghostEl.className = 'drag-ghost';
    renderBlockArms(drag.ghostEl, drag.block);
    document.body.appendChild(drag.ghostEl);
    drag.curX = e.clientX; drag.curY = e.clientY;
    drag.sourceEl = drag.origin==='hand'
      ? handEl.querySelector(`.hand-slot[data-idx="${drag.idx}"]`)
      : boardEl.querySelector(`.cell[data-r="${drag.r}"][data-c="${drag.c}"]`);
    if(drag.sourceEl) drag.sourceEl.classList.add('drag-source-fade');
    dragGhostLoop(drag);
  }
  if(drag.moved) updateDropHover(e.clientX, e.clientY);
}

function dragGhostLoop(dragState){
  if(!dragState || !dragState.moved) return;
  const dx = dragState.targetX - dragState.curX, dy = dragState.targetY - dragState.curY;
  dragState.curX += dx*0.3; dragState.curY += dy*0.3;
  const tilt = Math.max(-16, Math.min(16, dx*0.15));
  dragState.ghostEl.style.left = dragState.curX+'px'; dragState.ghostEl.style.top = dragState.curY+'px';
  dragState.ghostEl.style.transform = `translate(-50%,-50%) rotate(${tilt}deg) scale(1.12)`;
  dragState.raf = requestAnimationFrame(()=>dragGhostLoop(dragState));
}

// board-origin drags may land on an occupied cell (swap); hand-origin drags may only land on empty cells
function dropTargetCell(el){
  const cellEl = el && el.closest ? el.closest('.cell') : null;
  if(!cellEl || cellEl.classList.contains('node') || cellEl.classList.contains('hole') || cellEl.classList.contains('black-block')) return null;
  const targetLocked = cellEl.classList.contains('locked-cell');
  const targetOccupied = cellEl.classList.contains('hasblock');
  // A locked block itself can never be moved, and a normal block may not swap it
  // out of a locked cell. An empty locked cell is still a valid placement target.
  if(targetLocked && targetOccupied && !blockIgnoresCellHazards(state.cells[+cellEl.dataset.r]?.[+cellEl.dataset.c]?.block)) return null;
  if(drag.origin==='hand' && targetOccupied) return null;
  if(drag.origin==='board' && +cellEl.dataset.r===drag.r && +cellEl.dataset.c===drag.c) return null;
  return cellEl;
}
function updateDropHover(x,y){
  document.querySelectorAll('.cell.drop-hover,.hand-slot.drop-hover').forEach(c=>c.classList.remove('drop-hover'));
  const el = document.elementFromPoint(x,y);
  const handSlot = el && el.closest ? el.closest('.hand-slot.filled') : null;
  if(handSlot && drag && drag.origin==='hand' && +handSlot.dataset.idx!==drag.idx){ handSlot.classList.add('drop-hover'); return; }
  const cellEl = dropTargetCell(el);
  if(cellEl) cellEl.classList.add('drop-hover');
}

function animateDragReturn(info){
  if(!info.ghostEl || !info.sourceEl){
    if(info.sourceEl) info.sourceEl.classList.remove('drag-source-fade');
    return;
  }
  const src=info.sourceEl.querySelector('.ball-chip')?.getBoundingClientRect() || info.sourceEl.getBoundingClientRect();
  const ghost=info.ghostEl.getBoundingClientRect();
  const dx=(src.left+src.width/2)-(ghost.left+ghost.width/2);
  const dy=(src.top+src.height/2)-(ghost.top+ghost.height/2);
  info.ghostEl.style.transition='transform calc(.24s / var(--anim-speed)) cubic-bezier(.22,.8,.24,1), opacity calc(.24s / var(--anim-speed)) ease';
  info.ghostEl.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(1)`;
  setTimeout(()=>{ if(info.ghostEl) info.ghostEl.remove(); if(info.sourceEl) info.sourceEl.classList.remove('drag-source-fade'); },scaledDuration(250));
}

function onDragEnd(e){
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  if(!drag) return;

  if(drag.raf) cancelAnimationFrame(drag.raf);

  if(!drag.moved){
    if(drag.origin==='board' && state.cells[drag.r]?.[drag.c]?.locked && !blockIgnoresCellHazards(state.cells[drag.r][drag.c]?.block)){
      const lockedEl=boardEl.querySelector(`.cell[data-r="${drag.r}"][data-c="${drag.c}"]`);
      pulseLockedBlock(lockedEl);
      drag=null;
      return;
    }
    drag.block.rotation = (drag.block.rotation+1)%4;
    const containerEl = drag.origin==='hand'
      ? handEl.querySelector(`.hand-slot[data-idx="${drag.idx}"]`)
      : boardEl.querySelector(`.cell[data-r="${drag.r}"][data-c="${drag.c}"]`);
    const visual = containerEl && containerEl.querySelector('.block-visual');
    if(visual){
      const nextDeg = parseFloat(visual.dataset.deg||'0') + 90;
      visual.dataset.deg = nextDeg;
      visual.style.transform = `rotate(${nextDeg}deg)`;
    }
    syncHoleConnectionsForBlock(drag.r, drag.c);
    drag = null;
    return;
  }

  if(drag.ghostEl) drag.ghostEl.remove();
  document.querySelectorAll('.cell.drop-hover').forEach(c=>c.classList.remove('drop-hover'));

  const el = document.elementFromPoint(e.clientX, e.clientY);

  const handSlot = el && el.closest ? el.closest('.hand-slot.filled') : null;
  if(handSlot && drag.origin==='hand'){
    const targetIdx = +handSlot.dataset.idx;
    if(targetIdx !== drag.idx){
      [state.hand[drag.idx], state.hand[targetIdx]] = [state.hand[targetIdx], state.hand[drag.idx]];
      render();
    }
    drag = null;
    return;
  }

  const cellEl = dropTargetCell(el);

  if(cellEl){
    const r=+cellEl.dataset.r, c=+cellEl.dataset.c;
    if(drag.origin==='hand'){
      state.cells[r][c] = {
        type:'empty',
        block: drag.block,
        locked: !!state.cells[r][c].locked,
        debuff: !!state.cells[r][c].debuff
      };
      recordBlockPlaced(drag.block);
      state.hand[drag.idx] = null;
      refillHand(true);
    } else if(drag.origin==='board'){
      const targetHadBlock=!!state.cells[r][c].block;
      const sourceRect=drag.sourceEl?.getBoundingClientRect();
      const targetRect=cellEl.getBoundingClientRect();
      state.cells[drag.r][drag.c].block = state.cells[r][c].block || null;
      state.cells[r][c].block = drag.block;
      if(targetHadBlock && sourceRect && targetRect) swapAnim={source:{r,c},target:{r:drag.r,c:drag.c},sourceRect,targetRect};
    }
    placeAnimCell = {r,c};
    drag.sourceEl?.classList.remove('drag-source-fade');
  } else {
    animateDragReturn(drag);
  }
  render();
  drag = null;
}

function syncHoleConnectionsForBlock(r,c){
  const block=state.cells[r]?.[c]?.block;
  if(!block) return;
  for(const d of [0,1,2,3]){
    const [dx,dy]=DIR_VEC[d], hr=r+dy, hc=c+dx;
    if(hr<0||hr>=state.rows||hc<0||hc>=state.cols||state.cells[hr][hc].type!=='hole') continue;
    const key=`${hr},${hc},${opposite(d)}`;
    const connected=openSides(block).includes(d);
    const holeEl=boardEl.querySelector(`.cell.hole[data-r=\"${hr}\"][data-c=\"${hc}\"]`);
    if(connected){
      if(state.holeConnections.has(key)) continue;
      const connector=document.createElement('div');
      connector.className='hole-connector '+DIR_NAMES[opposite(d)];
      if(holeEl) holeEl.appendChild(connector);
      state.holeConnections.add(key);
    } else if(state.holeConnections.has(key)){
      const connector=holeEl?.querySelector(`.hole-connector.${DIR_NAMES[opposite(d)]}`);
      if(connector){ connector.classList.add('retracting'); setTimeout(()=>connector.remove(),scaledDuration(290)); }
      state.holeConnections.delete(key);
    }
  }
}

