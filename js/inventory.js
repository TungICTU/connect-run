// ---------- inventory (bag contents) ----------
const inventoryOverlayEl = document.getElementById('inventoryOverlay');
const debugOverlayEl=document.getElementById('debugOverlay');
const debugTargetInfoEl=document.getElementById('debugTargetInfo');
document.addEventListener('mousemove', e=>{
  if(!debugOverlayEl.classList.contains('hidden') && debugOverlayEl.contains(e.target)) return;
  let n=document.elementFromPoint(e.clientX,e.clientY), found=null;
  while(n){ if(n.__debugTarget){found=n.__debugTarget;break;} if(n===document.body) break; n=n.parentElement; }
  debugHoverTarget=found;
  if(!debugOverlayEl.classList.contains('hidden')){ debugTargetInfoEl.innerHTML=debugDescribeTarget(found); debugRefreshSelects(); }
});
const debugLevelInput=document.getElementById('debugLevelInput');
const debugUpgradeSelect=document.getElementById('debugUpgradeSelect');
const debugPowerSelect=document.getElementById('debugPowerSelect');
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
  state.level=level;
  state.target=computeTarget(level);
  levelValEl.textContent=formatNumber(state.level);
  targetValEl.textContent=formatNumber(state.target);
  render();
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

