// ---------- targeting mode (power cards) ----------
function targetKindMatches(def, kind){
  if(def.targetKind === 'both') return true;
  if(def.targetKind === 'swap'){
    if(!state.targeting.targets.length) return true;
    return state.targeting.targets[0].kind === kind;
  }
  return def.targetKind === kind;
}
function targetMatchesDef(def, obj, kind){
  if(!targetKindMatches(def,kind)) return false;
  if(typeof def.targetPredicate==='function' && !def.targetPredicate(obj)) return false;
  return true;
}

function rememberLastUsedCard(def){
  if(!def || def.id==='copy') return;
  state.lastUsedCard={kind:'power',defId:def.id};
}

function commitTargeting(){
  const t=state.targeting; if(!t) return false;
  const def=t.def, min=def.targetMinCount||def.targetCount, max=def.targetCount;
  if(t.targets.length<min || t.targets.length>max) return false;
  if(!t.targets.every(x=>targetMatchesDef(def,x.obj,x.kind))) return false;
  def.use(t.targets); rememberLastUsedCard(def); syncBallMutationTargets(t.targets); renderBallQueue();
  state.cardHand.splice(t.handIdx,1); state.targeting=null; render(); renderTargetBanner();
  if(state.phase==='shop') refreshOpenShop();
  return true;
}

function activateCardFromHand(handIdx, def){
  if(!def) return;
  const card=state.cardHand[handIdx];
  if(!card) return;
  if(card.kind==='upgrade'){
    def.apply();
    state.lastUpgrade=def;
    state.lastUsedCard={kind:'upgrade',defId:def.id};
    state.cardHand.splice(handIdx,1);
    render();
    renderTargetBanner();
    scheduleAutoSave();
    return;
  }
  activatePowerCardFromHand(handIdx, def);
}

function activatePowerCardFromHand(handIdx, def){
  if(!def) return;
  if(def.targetCount===0){
    state.cardHand.splice(handIdx,1);
    def.use([]);
    rememberLastUsedCard(def);
    render();
    return;
  }
  startTargeting(handIdx, def);
}

function startTargeting(handIdx, def){
  if(def.targetCount===0){
    state.cardHand.splice(handIdx,1);
    def.use([]); rememberLastUsedCard(def); render(); return;
  }
  state.targeting={handIdx,def,need:def.targetCount,targets:[]};
  render();
  renderTargetBanner();
}

function cancelTargeting(){
  state.targeting = null;
  inventoryOverlayEl.classList.add('hidden');
  inventoryOverlayEl.innerHTML='';
  render();
  renderTargetBanner();
  if(state.phase==='shop') refreshOpenShop();
}

function handleTargetClick(target){
  const t = state.targeting;
  if(!t) return;
  const def = t.def;
  if(!targetMatchesDef(def, target.obj, target.kind)) return;
  const existing = t.targets.findIndex(x=>x.obj===target.obj);
  if(existing>=0){
    t.targets.splice(existing,1);
  } else {
    if(t.targets.length>=t.need) return;
    t.targets.push(target);
  }
  if(t.targets.length >= t.need && !def.manualConfirm){
    commitTargeting();
  } else {
    render();
    renderTargetBanner();
  }
}

function renderTargetBanner(){
  const shopIsOpen = !shopOverlayEl.classList.contains('hidden');
  const shopPanel = shopIsOpen ? shopOverlayEl.querySelector('.shop-panel') : null;
  if(!state.targeting){
    targetBannerEl.classList.add('hidden');
    targetBannerEl.innerHTML='';
    shopPanel?.classList.remove('targeting-pass-through');
    return;
  }

  targetBannerEl.classList.remove('hidden');
  shopPanel?.classList.add('targeting-pass-through');
  const t=state.targeting;
  targetBannerEl.innerHTML='';

  const span=document.createElement('span');
  span.textContent=`Chọn mục tiêu cho ${t.def.name} (${t.targets.length}/${t.need})`;
  targetBannerEl.appendChild(span);

  const cancelBtn=document.createElement('button');
  cancelBtn.textContent='Huỷ';
  cancelBtn.addEventListener('click', e=>{
    e.preventDefault();
    e.stopPropagation();
    cancelTargeting();
  });
  targetBannerEl.appendChild(cancelBtn);

  if(t.def.manualConfirm){
    const confirmBtn=document.createElement('button');
    confirmBtn.className='gold';
    confirmBtn.textContent='Xác nhận';
    confirmBtn.disabled=t.targets.length<(t.def.targetMinCount||1);
    confirmBtn.addEventListener('click', e=>{
      e.preventDefault();
      e.stopPropagation();
      if(!confirmBtn.disabled) commitTargeting();
    });
    targetBannerEl.appendChild(confirmBtn);
  }
}

