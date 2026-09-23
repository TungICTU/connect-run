// ---------- inventory (bag contents) ----------
const inventoryOverlayEl = document.getElementById('inventoryOverlay');
const debugOverlayEl=document.getElementById('debugOverlay');
const debugTargetInfoEl=document.getElementById('debugTargetInfo');
let debugHoverLocationLevel=null;
let debugHoverCell=null;
const debugBossTargetInfoEl=document.getElementById('debugBossTargetInfo');
const debugBossSelect=document.getElementById('debugBossSelect');
const debugAddBossBtn=document.getElementById('debugAddBossBtn');
const debugRemoveBossBtn=document.getElementById('debugRemoveBossBtn');
const debugChangeBossBtn=document.getElementById('debugChangeBossBtn');
document.addEventListener('mousemove', e=>{
  if(!debugOverlayEl.classList.contains('hidden') && debugOverlayEl.contains(e.target)) return;
  let n=document.elementFromPoint(e.clientX,e.clientY), found=null, cellFound=null, locationLevel=null;
  while(n){
    if(!found && n.__debugTarget && n.__debugTarget.kind!=='cell') found=n.__debugTarget;
    if(!cellFound && n.__debugCellTarget) cellFound=n.__debugCellTarget;
    if(locationLevel===null && n.__debugLocationTarget) locationLevel=n.__debugLocationTarget.level;
    if(n===document.body) break;
    n=n.parentElement;
  }
  debugHoverTarget=found;
  debugHoverCellTarget=cellFound || null;
  debugHoverCell=cellFound?.cell || null;
  debugHoverLocationLevel=locationLevel===null ? null : Number(locationLevel);
  if(!debugOverlayEl.classList.contains('hidden')){
    debugTargetInfoEl.innerHTML=debugDescribeTarget(found);
    debugRefreshSelects();
    refreshDebugCellControls();
    debugRefreshBossControls();
  }
});
const debugLevelInput=document.getElementById('debugLevelInput');
const debugUpgradeSelect=document.getElementById('debugUpgradeSelect');
const debugPowerSelect=document.getElementById('debugPowerSelect');
function populateDebugBossSelect(){
  if(!debugBossSelect) return;
  debugBossSelect.innerHTML='';
  Object.values(BOSS_DEFS).forEach(def=>{
    const o=document.createElement('option');
    o.value=def.id;
    o.textContent=def.name;
    o.style.color=def.color;
    debugBossSelect.appendChild(o);
  });
}

function debugRefreshBossControls(){
  if(!debugBossTargetInfoEl || !debugBossSelect) return;
  if(debugHoverLocationLevel===null){
    debugBossTargetInfoEl.innerHTML='<span class="debug-none">Hãy đưa con trỏ tới một màn trên location bar.</span>';
    debugBossSelect.disabled=true;
    debugAddBossBtn?.setAttribute('disabled','');
    debugRemoveBossBtn?.setAttribute('disabled','');
    debugChangeBossBtn?.setAttribute('disabled','');
    return;
  }
  const level=debugHoverLocationLevel;
  const boss=getBossDefForLevel(level);
  debugBossTargetInfoEl.innerHTML=boss
    ? `<strong style="color:${boss.color}">Màn ${level}</strong><br>Boss: <span style="color:${boss.color}">${boss.name}</span>`
    : `<strong>Màn ${level}</strong><br>Boss: Không có`;
  debugBossSelect.disabled=false;
  debugBossSelect.value=boss?.id || debugBossSelect.value || BOSS_ALL_IDS[0];
  debugAddBossBtn?.toggleAttribute('disabled', !!boss);
  debugRemoveBossBtn?.toggleAttribute('disabled', !boss);
  debugChangeBossBtn?.toggleAttribute('disabled', !boss);
}

function refreshDebugCellControls(){
  const info=document.getElementById('debugCellTargetInfo');
  const sel=document.getElementById('debugCellTypeSelect');
  const btn=document.getElementById('debugApplyCellBtn');
  if(!info || !sel || !btn) return;
  if(!debugHoverCell){
    info.innerHTML='<span class="debug-none">Hãy đưa con trỏ tới một ô trên bảng chơi.</span>';
    sel.disabled=true;
    btn.disabled=true;
    return;
  }
  const r=debugHoverCellTarget?.el?.dataset?.r;
  const c=debugHoverCellTarget?.el?.dataset?.c;
  info.innerHTML=`<strong>Ô ${r ?? '?'}:${c ?? '?'}</strong><br>Loại: ${debugCellKindLabel(debugHoverCell)}${debugHoverCell.block ? '<br>Đang có khối' : ''}`;
  const kind = debugHoverCell.type==='black' ? 'black' : debugHoverCell.assassinTarget ? 'assassinTarget' : debugHoverCell.locked ? 'locked' : debugHoverCell.debuff ? 'debuff' : debugHoverCell.nerf ? 'nerf' : debugHoverCell.controlled ? 'controlled' : 'empty';
  sel.disabled=false;
  sel.value=kind;
  btn.disabled=false;
}

function debugApplyCell(){
  const target=debugHoverCellTarget;
  if(!target?.cell || !state) return;
  const r=Number(target.el?.dataset?.r), c=Number(target.el?.dataset?.c);
  if(!Number.isInteger(r)||!Number.isInteger(c)||!state.cells?.[r]?.[c]) return;
  const cell=state.cells[r][c];
  const next=document.getElementById('debugCellTypeSelect')?.value || 'empty';
  const previousBlock=cell.block;

  if(next==='black'){
    if(previousBlock){
      state.bag.push(previousBlock);
      cell.block=null;
    }
    cell.type='black';
    for(const key of BOSS_ADVERSE_KEYS) delete cell[key];
  }else{
    cell.type='empty';
    // Debugging a cell always makes the selected adverse type exclusive.
    for(const key of BOSS_ADVERSE_KEYS) cell[key]=false;
    if(next!=='empty') cell[next]=true;
    if(next==='assassinTarget' && state.boss?.id==='assassin'){
      const key=`${r},${c}`;
      if(!state.boss.assassinTargets.includes(key)) state.boss.assassinTargets.push(key);
    }
    if(next!=='assassinTarget' && state.boss?.assassinTargets){
      state.boss.assassinTargets=state.boss.assassinTargets.filter(key=>key!==`${r},${c}`);
    }
  }

  if(cell.type==='black') cell.block=null;
  render();
  renderLocationBar?.(false);
  renderTargetBanner?.();
  scheduleAutoSave();
  debugHoverCellTarget = {el: boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`), cell};
  debugHoverCell = cell;
  refreshDebugCellControls();
}

function clearDebugTargetCellReference(){
  debugHoverCellTarget=null;
  debugHoverCell=null;
}

function populateDebugCardSelects(){
  debugUpgradeSelect.innerHTML='';
  UPGRADE_POOL.forEach(def=>{
    const o=document.createElement('option'); o.value=def.id; o.textContent=def.name; debugUpgradeSelect.appendChild(o);
  });
  debugPowerSelect.innerHTML='';
  Object.values(POWER_CARD_DEFS).forEach(def=>{
    const o=document.createElement('option'); o.value=def.id; o.textContent=def.name; debugPowerSelect.appendChild(o);
  });
}
function refreshDebugMenuValues(){
  if(state){ debugLevelInput.value=state.level||1; }
  populateDebugCardSelects();
  populateDebugBossSelect();
}
async function debugAdvanceLevel(){
  if(!state || state.resolving || state.phase==='reward') return;

  // Route the debug action through the normal win pipeline. This gives the
  // debug button the same board animation, gold rewards, win overlay and
  // reward-collection flow as a genuine completed level.
  runGeneration++;
  state.resolving = false;
  state.targeting = null;
  state.phase = 'playing';
  document.querySelectorAll('.ball, .ball-tooltip, .ball-goal-popup, .steel-multiplier-tooltip, .gold-reward-tooltip, .block-exit-tooltip').forEach(el=>el.remove());
  state.score = Math.max(state.score, state.target);
  scoreValEl.textContent = formatNumber(state.score);

  await checkEndState();
  scheduleAutoSave();
}

function debugSetLevel(){
  const level=Math.max(1,Math.floor(Number(debugLevelInput.value)||1));
  if(!state) return;
  clearBossTransientBlockFlags();
  state.level=level;
  ensureBossForLevel(level);
  state.target=getBossTarget(computeTarget(level));
  state.discardsLeft=getMaxDiscards();
  levelValEl.textContent=formatNumber(state.level);
  targetValEl.textContent=formatNumber(state.target);
  render();
  renderLocationBar?.(false);
  renderTargetBanner();
  refreshOpenShop();
  scheduleAutoSave();
}
function debugAddCard(kind, defId){
  if(!state) return;
  if(state.cardHand.length>=getMaxCardHand()){
    return;
  }
  const def=kind==='upgrade' ? UPGRADE_POOL.find(x=>x.id===defId) : POWER_CARD_DEFS[defId];
  if(!def) return;
  state.cardHand.push({id:cardUid(),kind,defId:def.id});
  render();
  renderTargetBanner();
  scheduleAutoSave();
}
function toggleDebugMenu(){
  debugOverlayEl.classList.toggle('hidden');
  if(!debugOverlayEl.classList.contains('hidden')){
    refreshDebugMenuValues();
    debugTargetInfoEl.innerHTML=debugDescribeTarget(debugHoverTarget);
    debugRefreshSelects();
    refreshDebugCellControls();
    debugRefreshBossControls();
  }
}
document.addEventListener('keydown', e=>{ if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='d'){e.preventDefault();toggleDebugMenu();} });
document.getElementById('debugCloseBtn').addEventListener('click',()=>debugOverlayEl.classList.add('hidden'));
document.getElementById('debugAddMoneyBtn').addEventListener('click',()=>{ const amount=Number(document.getElementById('debugMoneyInput').value)||0; state.money+=amount; moneyValEl.textContent=formatMoney(state.money); if(!shopOverlayEl.classList.contains('hidden')) renderShop(); scheduleAutoSave(); });
document.getElementById('debugSetLevelBtn').addEventListener('click',debugSetLevel);
document.getElementById('debugAdvanceLevelBtn').addEventListener('click',debugAdvanceLevel);
document.getElementById('debugAddUpgradeBtn').addEventListener('click',()=>debugAddCard('upgrade',debugUpgradeSelect.value));
document.getElementById('debugAddPowerBtn').addEventListener('click',()=>debugAddCard('power',debugPowerSelect.value));
document.getElementById('debugApplyTargetBtn').addEventListener('click',debugApplyTarget);
document.getElementById('debugApplyCellBtn')?.addEventListener('click',debugApplyCell);


debugAddBossBtn?.addEventListener('click',()=>{
  if(debugHoverLocationLevel===null || !debugBossSelect?.value) return;
  debugSetBossForLevel(debugHoverLocationLevel,debugBossSelect.value);
  debugRefreshBossControls();
});
debugRemoveBossBtn?.addEventListener('click',()=>{
  if(debugHoverLocationLevel===null) return;
  debugRemoveBossForLevel(debugHoverLocationLevel);
  debugRefreshBossControls();
});
debugChangeBossBtn?.addEventListener('click',()=>{
  if(debugHoverLocationLevel===null || !debugBossSelect?.value) return;
  debugSetBossForLevel(debugHoverLocationLevel,debugBossSelect.value);
  debugRefreshBossControls();
});
document.getElementById('inventoryBtn').addEventListener('click', openInventory);

function collectOwnedBlocks(){
  const owned = [];
  for(const b of state.bag) owned.push({block:b,status:'available'});
  for(const b of state.hand) if(b) owned.push({block:b,status:'hand'});
  for(const b of state.discardPile) owned.push({block:b,status:'discarded'});
  if(state.cells){
    for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
      const b=state.cells[r][c].block;
      if(b) owned.push({block:b,status:'board'});
    }
  }
  const propOrder={wood:0,stone:1,gold:2,steel:3,glass:4};
  const enhOrder={holo:0,spark:1,invert:2};
  owned.sort((a,b)=>{
    const ba=a.block, bb=b.block;
    return ({straight:0,L:1,T:2,plus:3}[ba.type]-{straight:0,L:1,T:2,plus:3}[bb.type])
      || (!!ba.property-!!bb.property)
      || (!!ba.enhancement-!!bb.enhancement)
      || ((propOrder[ba.property]??99)-(propOrder[bb.property]??99))
      || ((enhOrder[ba.enhancement]??99)-(enhOrder[bb.enhancement]??99));
  });
  return owned;
}

function openInventory(){
  const list = collectOwnedBlocks();
  const panel = document.createElement('div'); panel.className='overlay-panel inventory-panel';
  const h2 = document.createElement('h2');
  h2.textContent = `Kho đồ — ${list.length} khối`;
  panel.appendChild(h2);

  const grid = document.createElement('div'); grid.className='inventory-grid';
  if(!list.length){
    grid.innerHTML='<div class="tag-empty">Trống</div>';
  } else {
    list.forEach(({block,status})=>{
      const item=document.createElement('div');
      item.className='inventory-item' + (status==='discarded'||status==='board' ? ' grayed' : '');
      renderBlockArms(item,block);
      grid.appendChild(item);
    });
  }
  panel.appendChild(grid);
  const closeBtn=document.createElement('button'); closeBtn.className='gold'; closeBtn.textContent='Đóng';
  closeBtn.addEventListener('click',()=>inventoryOverlayEl.classList.add('hidden'));
  panel.appendChild(closeBtn);
  inventoryOverlayEl.innerHTML=''; inventoryOverlayEl.appendChild(panel);
  inventoryOverlayEl.classList.remove('hidden');
}

