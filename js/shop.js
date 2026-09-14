// ---------- shop ----------
const shopOverlayEl = document.getElementById('shopOverlay');
const gachaOverlayEl = document.getElementById('gachaOverlay');
let activeRenderShop = null;
let activeRefreshGachaBalls = null;
window.addEventListener('resize', ()=>{ if(activeRenderShop && !shopOverlayEl.classList.contains('hidden')) activeRenderShop(); });
function refreshOpenShop(){
  if(activeRenderShop && !shopOverlayEl.classList.contains('hidden')) activeRenderShop();
}
function refreshOpenGachaBalls(){
  if(activeRefreshGachaBalls && !gachaOverlayEl.classList.contains('hidden')) activeRefreshGachaBalls();
}
function hideShop(){ shopOverlayEl.classList.add('hidden'); shopOverlayEl.classList.remove('targeting-pass-through'); shopOverlayEl.innerHTML=''; hideGachaChoice(); cardHandEl.classList.remove('shop-active'); }
function hideGachaChoice(){ activeRefreshGachaBalls=null; gachaOverlayEl.classList.add('hidden'); gachaOverlayEl.innerHTML=''; }

function genBlockOptions(tier){
  const arr=[];
  for(let i=0;i<tier.options;i++){
    const type=pick(Object.keys(BASE_SIDES));
    const core=Math.random()<0.10 ? randomCore() : null;
    arr.push({type,property:rollProp(BLOCK_PROPS,0.33),enhancement:rollProp(ENHANCEMENTS,0.10),core,color:null});
  }
  return arr;
}
function genBallOptions(tier){
  const arr=[]; for(let i=0;i<tier.options;i++){ const property=rollProp(BALL_PROPS,0.25); arr.push({property,enhancement:rollProp(ENHANCEMENTS,0.10),color:property?PROP_COLOR[property]:null}); }
  return arr;
}
function genUpgradeOptions(tier){ return Array.from({length:tier.options},()=>({defId:pick(UPGRADE_POOL).id})); }

function gachaPrice(type, tier){
  const tierKey = tier?.key || 'small';
  const prices = {
    upgrade: {small:4, large:7, mega:10},
    power:   {small:4, large:7, mega:10},
    block:   {small:8, large:12, mega:15},
    ball:    {small:10, large:15, mega:22},
  };
  return prices[type]?.[tierKey] ?? tier?.cost ?? 0;
}

function specialBlock(){
  let b={type:pick(Object.keys(BASE_SIDES)),rotation:0,property:null,enhancement:null};
  while(!b.property&&!b.enhancement){ b.property=rollProp(BLOCK_PROPS,0.6); b.enhancement=rollProp(ENHANCEMENTS,0.35); }
  return b;
}
function specialBall(){
  return {property:pick(BALL_PROPS),enhancement:rollProp(ENHANCEMENTS,0.35)};
}
function blockPrice(b){
  return 3
    + ({wood:3,stone:3,steel:4,gold:4,glass:6}[b.property]||0)
    + ({holo:7,spark:5,invert:10}[b.enhancement]||0);
}
function ballPrice(b){
  return 20 + ({grid:2,striped:4,gold:6,steel:8,glass:8}[b.property]||0)
    + ({holo:6,spark:11,invert:18}[b.enhancement]||0);
}

function blockOptionLabel(b){
  const prop = b.property ? PROP_LABEL[b.property] : '';
  const enh = b.enhancement ? ENH_LABEL[b.enhancement] : '';
  const core = b.core ? CORE_LABEL[b.core.id] + (coreHasCount(b.core) ? ` (${b.core.count})` : '') : '';
  return `${renderMiniBlockMarkup(b)}<div>${TYPE_LABEL[b.type]}</div><div>${prop}${prop&&enh?' · ':''}${enh}</div>${core?`<div>${core}</div>`:''}`;
}

function gachaBlockChoiceLabel(b){
  return renderMiniBlockMarkup(b);
}

function renderMiniBlockMarkup(block){
  const deg = block.rotation||0;
  const sides = BASE_SIDES[block.type].map(side => DIR_NAMES[(side+deg)%4]);
  const prop = block.property || '';
  const enh = block.enhancement || '';
  const propColor = prop ? PROP_COLOR[prop] : '';
  const colorStyle = propColor ? ` style="--prop-color:${propColor}"` : '';
  const core = block.core && CORE_DEFS[block.core.id] ? `<div class="block-core-dot" data-core="${block.core.id}">${coreHasCount(block.core) ? String(block.core.count) : ''}</div>` : '';
  return `<div class="mini-block" data-prop="${prop}" data-enh="${enh}"${colorStyle}>${sides.map(side=>`<div class="arm arm-${side}"></div>`).join('')}<div class="hub"></div>${core}</div>`;
}

function ballOptionLabel(b){
  return ballChipMarkup(b);
}

function powerOptionLabel(opt){
  const def=POWER_CARD_DEFS[opt.defId];
  return `<div class="mini-card">${def.name}</div>`;
}

function upgradeOptionLabel(opt){
  const def=UPGRADE_POOL.find(x=>x.id===opt.defId);
  return `<div class="mini-card">${def.name}</div>`;
}

function randomBagBlocks(count){
  const owned = collectOwnedBlocks().map(({block})=>block);
  return shuffle(owned).slice(0, Math.min(count, owned.length));
}

function genPowerOptions(tier){
  const defs=shuffle(Object.values(POWER_CARD_DEFS));
  return Array.from({length:tier.options},(_,i)=>({defId:defs[i%defs.length].id}));
}

function applyBlockPick(opt){
  state.bag.push({type:opt.type,rotation:0,property:opt.property||null,enhancement:opt.enhancement||null,core:cloneCore(opt.core)});
}

function addBallToPool(ball){
  const max = BASE_MAX_BALLS + state.maxBallsBonus;
  if(state.ballPool.length >= max) return false;
  state.ballPool.push({_id:ballUid(),property:ball.property||null, enhancement:ball.enhancement||null});
  syncBallQueueFromPool();
  refreshOpenShop();
  refreshOpenGachaBalls();
  return true;
}

function replaceBallInPool(index, ball){
  if(index<0 || index>=state.ballPool.length) return false;
  state.ballPool[index] = {_id:ballUid(), property:ball.property||null, enhancement:ball.enhancement||null};
  syncBallQueueFromPool();
  refreshOpenShop();
  refreshOpenGachaBalls();
  return true;
}

function applyPowerPick(opt, targets){
  const def=POWER_CARD_DEFS[opt.defId];
  if(!def) return false;
  if(def.targetCount===0){ def.use([]); return true; }
  const minTargets = def.targetMinCount ?? def.targetCount;
  const maxTargets = def.targetCount;
  if(!targets || targets.length<minTargets || targets.length>maxTargets) return false;
  if(def.targetKind==='swap'){
    if(targets.length!==2 || targets[0]?.kind!==targets[1]?.kind) return false;
  } else if(!targets.every(t=>targetMatchesDef(def,t.obj,t.kind))) {
    return false;
  }
  def.use(targets);
  rememberLastUsedCard(def);
  syncBallMutationTargets(targets);
  renderBallQueue();
  return true;
}

function applyUpgradePick(opt){
  const def=UPGRADE_POOL.find(x=>x.id===opt.defId);
  if(!def) return false;
  def.apply(); state.lastUpgrade=def; state.lastUsedCard={kind:'upgrade',defId:def.id};
  return true;
}

function showGachaChoice(g){
  gachaOverlayEl.innerHTML='';
  const panel=document.createElement('div'); panel.className='gacha-choice-panel';
  const head=document.createElement('div'); head.className='gacha-choice-head';
  const names={block:'Hộp khối',ball:'Hộp bóng',power:'Hộp thẻ sức mạnh',upgrade:'Hộp thẻ nâng cấp'};
  head.innerHTML=`<h2>${names[g.type]} — ${g.tier.label}</h2><p>${g.type==='power'?'Chọn thẻ và dùng ngay trên các mục tiêu được đưa ra, hoặc bỏ qua.':'Chọn phần thưởng, hoặc bỏ qua.'}</p>`;
  panel.appendChild(head);

  const stateUi={selected:[],ownedIndex:null,targeting:[],usedOptions:[]};
  const optionsWrap=document.createElement('div'); optionsWrap.className='gacha-choice-options';
  const gachaBallViews=[];
  const registerGachaBallView=(wrap,getBalls)=>{ gachaBallViews.push({wrap,getBalls}); };

  function finish(){
    syncBallQueueFromPool();
    hideGachaChoice();
    renderBallQueue();
    // renderShop() is local to openShop(); reopen the shop through its public entry point.
    openShop();
    scheduleAutoSave();
  }

  function skip(){ finish(); }

  if(g.type==='block'){
    optionsWrap.classList.add('gacha-block-options');
    g.options.forEach((opt,i)=>{
      const el=document.createElement('div');
      el.className='gacha-block-choice';
      el.innerHTML=gachaBlockChoiceLabel(opt);
      attachObjectTooltip(el, opt, 'block');
      el.addEventListener('click',()=>{
        if(stateUi.selected.includes(i)) stateUi.selected=stateUi.selected.filter(x=>x!==i);
        else if(stateUi.selected.length<g.tier.picks) stateUi.selected.push(i);
        optionsWrap.querySelectorAll('.gacha-block-choice').forEach((n,j)=>n.classList.toggle('selected',stateUi.selected.includes(j)));
        accept.disabled=!stateUi.selected.length;
        accept.textContent=`Nhận (${stateUi.selected.length}/${g.tier.picks})`;
      });
      optionsWrap.appendChild(el);
    });
    panel.appendChild(optionsWrap);
  } else if(g.type==='upgrade'){
    g.options.forEach((opt,i)=>{
      const el=document.createElement('div'); el.className='gacha-opt'; el.innerHTML=upgradeOptionLabel(opt);
      const def=UPGRADE_POOL.find(x=>x.id===opt.defId);
      if(def) attachCardTooltip(el, def);
      el.addEventListener('click',()=>{
        stateUi.selected = stateUi.selected.includes(i) ? [] : [i];
        optionsWrap.querySelectorAll('.gacha-opt').forEach((n,j)=>n.classList.toggle('selected',j===stateUi.selected[0]));
        accept.disabled=!stateUi.selected.length; accept.textContent=`Nâng cấp${g.tier.picks>1?` (${(g.upgradesUsed||0)+1}/${g.tier.picks})`:''}`;
      });
      optionsWrap.appendChild(el);
    });
    panel.appendChild(optionsWrap);
  } else if(g.type==='ball'){
    const note=document.createElement('div'); note.className='gacha-choice-section';
    const max=BASE_MAX_BALLS + state.maxBallsBonus;
    if(state.ballPool.length < max){
      const ownedWrap=document.createElement('div'); ownedWrap.className='ball-choice-grid';
      state.ballPool.forEach((b,i)=>{ const e=document.createElement('div'); e.className='ball-choice-item gacha-owned-ball'; e.innerHTML=ballOptionLabel(b); markDebugTarget(e,b,'ball'); attachObjectTooltip(e,b,'ball'); ownedWrap.appendChild(e); });
      note.appendChild(ownedWrap);
      registerGachaBallView(ownedWrap,()=>state.ballPool);
      panel.appendChild(note);
      const free=max-state.ballPool.length;
      g.options.forEach((opt,i)=>{
        const el=document.createElement('div'); el.className='ball-choice-item'; el.innerHTML=ballOptionLabel(opt);
        markDebugTarget(el,opt,'ball');
        attachObjectTooltip(el, opt, 'ball');
        el.addEventListener('click',()=>{
          if(stateUi.selected.includes(i)) stateUi.selected=stateUi.selected.filter(x=>x!==i);
          else if(stateUi.selected.length<Math.min(g.tier.picks,free)) stateUi.selected.push(i);
          optionsWrap.querySelectorAll('.ball-choice-item').forEach((n,j)=>n.classList.toggle('selected',stateUi.selected.includes(j)));
          accept.disabled=!stateUi.selected.length;
          accept.textContent=`Nhận (${stateUi.selected.length}/${Math.min(g.tier.picks,free)})`;
        });
        optionsWrap.appendChild(el);
      });
    } else {
      const ownedWrap=document.createElement('div'); ownedWrap.className='ball-choice-grid';
      state.ballPool.forEach((b,i)=>{ const e=document.createElement('div'); e.className='ball-choice-item gacha-owned-ball'; e.innerHTML=ballOptionLabel(b); markDebugTarget(e,b,'ball'); attachObjectTooltip(e,b,'ball'); e.addEventListener('click',()=>{ stateUi.ownedIndex=i; ownedWrap.querySelectorAll('.gacha-owned-ball').forEach((n,j)=>n.classList.toggle('selected',j===i)); accept.disabled=stateUi.selected.length!==1 || stateUi.ownedIndex===null; }); ownedWrap.appendChild(e); });
      note.appendChild(ownedWrap);
      registerGachaBallView(ownedWrap,()=>state.ballPool);
      panel.appendChild(note);
      g.options.forEach((opt,i)=>{
        const el=document.createElement('div'); el.className='ball-choice-item'; el.innerHTML=ballOptionLabel(opt);
        markDebugTarget(el,opt,'ball');
        attachObjectTooltip(el, opt, 'ball');
        el.addEventListener('click',()=>{ stateUi.selected=[i]; optionsWrap.querySelectorAll('.ball-choice-item').forEach((n,j)=>n.classList.toggle('selected',j===i)); accept.disabled=stateUi.ownedIndex===null; });
        optionsWrap.appendChild(el);
      });
    }
    optionsWrap.className='ball-choice-grid';
    const h3=document.createElement('div'); h3.className='gacha-choice-section'; h3.innerHTML='<h3>Bóng trong hộp gacha</h3>';
    h3.appendChild(optionsWrap); panel.appendChild(h3);
    registerGachaBallView(optionsWrap,()=>g.options);
  } else {
    const targets=randomBagBlocks(5);
    g.powerTargets=targets;
    const targetSec=document.createElement('div'); targetSec.className='gacha-choice-section gacha-power-targets';
    const targetWrap=document.createElement('div'); targetWrap.className='gacha-block-options gacha-power-block-options';
    targets.forEach((b,i)=>{
      const e=document.createElement('div');
      e.className='gacha-block-choice';
      e.innerHTML=gachaBlockChoiceLabel(b);
      markDebugTarget(e,b,'block');
      attachObjectTooltip(e,b,'block');
      e.addEventListener('click',()=>{
        if(!stateUi.targeting.some(x=>x.obj===b)){
          if(stateUi.targeting.length>=2) return;
          stateUi.targeting.push({obj:b,kind:'block'});
        } else {
          stateUi.targeting=stateUi.targeting.filter(x=>x.obj!==b);
        }
        targetWrap.querySelectorAll('.gacha-block-choice').forEach((n,j)=>n.classList.toggle('selected',stateUi.targeting.some(x=>x.obj===targets[j])));
        updatePowerAccept();
      });
      targetWrap.appendChild(e);
    });
    targetSec.appendChild(targetWrap); panel.appendChild(targetSec);

    const ballSec=document.createElement('div'); ballSec.className='gacha-choice-section gacha-power-owned-balls';
    const ballWrap=document.createElement('div'); ballWrap.className='ball-choice-grid';
    state.ballPool.forEach((b)=>{ const e=document.createElement('div'); e.className='ball-choice-item'; e.innerHTML=ballOptionLabel(b); attachObjectTooltip(e,b,'ball'); e.addEventListener('click',()=>{ if(!stateUi.targeting.some(x=>x.obj===b)){ stateUi.targeting.push({obj:b,kind:'ball'}); } else { stateUi.targeting=stateUi.targeting.filter(x=>x.obj!==b); } ballWrap.querySelectorAll('.ball-choice-item').forEach((n,j)=>n.classList.toggle('selected',stateUi.targeting.some(x=>x.obj===state.ballPool[j]))); updatePowerAccept(); }); ballWrap.appendChild(e); });
    ballSec.appendChild(ballWrap); panel.appendChild(ballSec);
    registerGachaBallView(ballWrap,()=>state.ballPool);

    const cardSec=document.createElement('div'); cardSec.className='gacha-choice-section'; cardSec.innerHTML='<h3>Thẻ sức mạnh</h3>';
    const cardWrap=document.createElement('div'); cardWrap.className='gacha-choice-options';
    g.options.forEach((opt,i)=>{ const e=document.createElement('div'); e.className='gacha-opt'; e.innerHTML=powerOptionLabel(opt); const def=POWER_CARD_DEFS[opt.defId]; if(def) attachCardTooltip(e, def); e.addEventListener('click',()=>{ if(stateUi.usedOptions?.includes(i)) return; stateUi.selected=[i]; stateUi.targeting=[]; targetWrap.querySelectorAll('.gacha-opt').forEach(n=>n.classList.remove('selected')); ballWrap.querySelectorAll('.ball-choice-item').forEach(n=>n.classList.remove('selected')); cardWrap.querySelectorAll('.gacha-opt').forEach((n,j)=>{ n.classList.toggle('selected',j===i); n.classList.toggle('disabled',stateUi.usedOptions?.includes(j)); }); updatePowerAccept(); }); cardWrap.appendChild(e); });
    cardSec.appendChild(cardWrap); panel.appendChild(cardSec);

    function updatePowerAccept(){
      const opt=g.options[stateUi.selected[0]];
      if(!opt){ accept.disabled=true; accept.textContent=`Dùng thẻ (${g.powerUsed||0}/${g.tier.picks})`; return; }
      const def=POWER_CARD_DEFS[opt.defId];
      if(def.targetCount===0){ accept.disabled=false; accept.textContent=`Dùng: ${def.name}`; return; }
      if(def.targetKind==='swap'){
        accept.disabled=stateUi.targeting.length!==2 || stateUi.targeting[0].kind!==stateUi.targeting[1].kind;
      } else {
        accept.disabled=stateUi.targeting.length<(def.targetMinCount||def.targetCount) || stateUi.targeting.length>def.targetCount || !stateUi.targeting.every(t=>targetMatchesDef(def,t.obj,t.kind));
      }
      accept.textContent=`Dùng: ${def.name}`;
    }
    panel._updatePowerAccept=updatePowerAccept;
  }

  const actions=document.createElement('div'); actions.className='gacha-choice-actions';
  const skipBtn=document.createElement('button'); skipBtn.className='skip'; skipBtn.textContent='Bỏ qua'; skipBtn.addEventListener('click',skip);
  const accept=document.createElement('button'); accept.className='gold'; accept.textContent='Nhận'; accept.disabled=true;
  accept.addEventListener('click',()=>{
    if(g.type==='block'){
      stateUi.selected.forEach(i=>applyBlockPick(g.options[i]));
      finish();
    } else if(g.type==='upgrade'){
      const opt = g.options[stateUi.selected[0]];
      if(opt) applyUpgradePick(opt);
      g.upgradesUsed=(g.upgradesUsed||0)+1;
      if(g.upgradesUsed>=g.tier.picks){ finish(); return; }
      stateUi.selected=[];
      optionsWrap.querySelectorAll('.gacha-opt').forEach(n=>n.classList.remove('selected'));
      accept.disabled=true;
      accept.textContent=`Nâng cấp (${g.upgradesUsed}/${g.tier.picks})`;
    } else if(g.type==='ball'){
      if(state.ballPool.length < BASE_MAX_BALLS + state.maxBallsBonus){
        stateUi.selected.forEach(i=>addBallToPool(g.options[i]));
      } else if(stateUi.selected.length===1 && stateUi.ownedIndex!==null){
        replaceBallInPool(stateUi.ownedIndex,g.options[stateUi.selected[0]]);
      }
      syncBallQueueFromPool();
      refreshOpenShop();
      finish();
    } else if(g.type==='power'){
      const opt=g.options[stateUi.selected[0]];
      if(!opt) return;
      const applied = applyPowerPick(opt, stateUi.targeting || []);
      if(!applied){
        if(panel._updatePowerAccept) panel._updatePowerAccept();
        return;
      }
      syncBallQueueFromPool();
      g.powerUsed=(g.powerUsed||0)+1;
      if(stateUi.selected.length) stateUi.usedOptions.push(stateUi.selected[0]);
      if(g.powerUsed>=g.tier.picks){ finish(); return; }
      stateUi.selected=[]; stateUi.targeting=[];
      panel.querySelectorAll('.gacha-choice-section .gacha-opt, .gacha-choice-section .ball-choice-item').forEach(n=>n.classList.remove('selected'));
      cardWrap.querySelectorAll('.gacha-opt').forEach((n,j)=>n.classList.toggle('disabled',stateUi.usedOptions.includes(j)));
      accept.disabled=true; accept.textContent=`Dùng thẻ (${g.powerUsed}/${g.tier.picks})`;
      if(panel._updatePowerAccept) panel._updatePowerAccept();
    }
  });
  actions.appendChild(skipBtn); actions.appendChild(accept); panel.appendChild(actions);

  activeRefreshGachaBalls=()=>{
    gachaBallViews.forEach(({wrap,getBalls})=>{
      const balls=getBalls();
      [...wrap.children].forEach((el,i)=>{
        const ball=balls[i];
        if(!ball) return;
        el.innerHTML=ballOptionLabel(ball);
        el.__debugTarget={el,obj:ball,kind:'ball'};
        if(!el.__gachaTooltipAttached){
          attachObjectTooltip(el,ball,'ball');
          el.__gachaTooltipAttached=true;
        }
      });
    });
  };
  if(g.type==='power' && panel._updatePowerAccept) panel._updatePowerAccept();
  gachaOverlayEl.appendChild(panel);
  refreshOpenGachaBalls();
  gachaOverlayEl.classList.remove('hidden');
}

function makeCommonItem(){
  const kind=pick(['upgrade','power','block']);
  if(kind==='upgrade'){ const def=pick(UPGRADE_POOL); return {kind,ref:{defId:def.id},name:def.name,desc:def.desc,price:def.cost}; }
  if(kind==='power'){ const def=pick(Object.values(POWER_CARD_DEFS)); return {kind,ref:{defId:def.id},name:def.name,desc:def.desc,price:def.cost}; }
  if(kind==='block'){ const b=specialBlock(); return {kind,ref:b,name:TYPE_LABEL[b.type],desc:(b.property?PROP_LABEL[b.property]:'')+(b.property&&b.enhancement?' · ':'')+(b.enhancement?ENH_LABEL[b.enhancement]:''),price:blockPrice(b)}; }
}
function makeCommonStock(){ return Array.from({length:2+Math.floor(Math.random()*2)}, makeCommonItem); }
function makeGachaBox(){
  const type=pick(['block','ball','power','upgrade']), tier=pick(GACHA_TIERS);
  return {id:cardUid(),type,tier,options:null,selected:[],done:false};
}
function makeGachaStock(){ return Array.from({length:1+Math.floor(Math.random()*2)}, makeGachaBox); }

function applyCommonItem(item){
  if(item.kind==='upgrade'){ const d=UPGRADE_POOL.find(x=>x.id===item.ref.defId); d.apply(); state.lastUpgrade=d; }
  else if(item.kind==='power'){ if(state.cardHand.length>=getMaxCardHand()) return false; state.cardHand.push({id:cardUid(),kind:item.kind,defId:item.ref.defId}); }
  else if(item.kind==='block') state.pendingBlocks.push({...item.ref, core:cloneCore(item.ref.core)});
  else state.nextBallPreset={...item.ref};
  return true;
}

function rerollShop(){
  if(state.money<state.commonRerollCost) return;
  state.money-=state.commonRerollCost;
  state.commonRerollCost++;
  state.commonItems=makeCommonStock();
  moneyValEl.textContent=formatMoney(state.money);
  renderShop();
  scheduleAutoSave();
}

function buyCommonShop(item){
  if(item.bought || state.money < shopPrice(item.price)) return;
  if((item.kind==='upgrade'||item.kind==='power') && state.cardHand.length>=getMaxCardHand()) return;

  if(item.kind==='upgrade' || item.kind==='power'){
    state.cardHand.push({id:cardUid(),kind:item.kind,defId:item.ref.defId});
  } else if(!applyCommonItem(item)) {
    return;
  }

  state.money-=shopPrice(item.price);
  item.bought=true;
  moneyValEl.textContent=formatMoney(state.money);
  render();
  refreshOpenShop();
  scheduleAutoSave();
}

function useCommonShop(item){
  if(item.bought || state.money < shopPrice(item.price)) return;
  if(item.kind!=='power' && item.kind!=='upgrade') return;

  const def = item.kind==='power' ? POWER_CARD_DEFS[item.ref.defId] : UPGRADE_POOL.find(x=>x.id===item.ref.defId);
  if(!def) return;
  if(item.kind==='power' && state.cardHand.length>=getMaxCardHand()) return;

  const handIdx=state.cardHand.length;
  state.cardHand.push({id:cardUid(),kind:item.kind,defId:def.id});
  state.money-=shopPrice(item.price);
  item.bought=true;
  moneyValEl.textContent=formatMoney(state.money);

  render();
  activateCardFromHand(handIdx, def);
  refreshOpenShop();
  scheduleAutoSave();
}

function renderGachaBoxShop(g){
  const box=document.createElement('div'); box.className='gacha-box';
  const names={block:'Hộp khối',ball:'Hộp bóng',power:'Hộp thẻ sức mạnh',upgrade:'Hộp thẻ nâng cấp'};
  if(g.done){
    box.innerHTML=`<div class="gacha-head"><span>${names[g.type]} ${g.tier.label.toLowerCase()}</span></div><div class="tag-done">Đã dùng</div>`;
    return box;
  }
  box.innerHTML=`<div class="shop-price">${formatMoney(shopPrice(gachaPrice(g.type, g.tier)))}</div><div class="shop-item-name">${names[g.type]} ${g.tier.label}</div>`;
  const actions=document.createElement('div'); actions.className='shop-item-actions';
  const gachaCost=shopPrice(gachaPrice(g.type, g.tier));
  const buy=document.createElement('button'); buy.textContent='Mở hộp'; buy.disabled=state.money<gachaCost; buy.addEventListener('click',()=>{
    state.money-=gachaCost;
    moneyValEl.textContent=formatMoney(state.money);
    g.done=true;
    g.options=g.type==='block'?genBlockOptions(g.tier):g.type==='ball'?genBallOptions(g.tier):g.type==='power'?genPowerOptions(g.tier):genUpgradeOptions(g.tier);
    renderShop();
    showGachaChoice(g);
    scheduleAutoSave();
  });
  actions.appendChild(buy);
  box.appendChild(actions);
  return box;
}

function positionShopPanel(panel){
  const anchor=ballQueueEl.getBoundingClientRect();
  const top=Math.max(8, anchor.bottom + 10);
  panel.style.top=`${Math.round(top)}px`;
  panel.style.maxHeight=`calc(100dvh - ${Math.round(top)}px - 16px)`;
}

function renderShop(){
  if(!state) return;
  syncBallQueueFromPool();
  shopOverlayEl.innerHTML='';
  const panel=document.createElement('div'); panel.className='shop-panel';
  panel.innerHTML=`<h2 class="shop-title">CỬA HÀNG</h2>`;
  positionShopPanel(panel);
  if(state.targeting) panel.classList.add('targeting-pass-through');

  const common=document.createElement('div'); common.className='shop-section'; common.innerHTML='<h3>Hàng hóa chung</h3>';
  const commonGrid=document.createElement('div'); commonGrid.className='shop-common-grid';
  state.commonItems.forEach(item=>{
    const row=document.createElement('div'); row.className='shop-card';
    const price=document.createElement('div'); price.className='shop-price price'; price.textContent=formatMoney(shopPrice(item.price));
    row.appendChild(price);

    const visual=document.createElement('div'); visual.className='shop-item-visual';
    if(item.kind==='block'){
      const blockVisual=document.createElement('div');
      blockVisual.innerHTML=renderMiniBlockMarkup(item.ref);
      markDebugTarget(blockVisual, item.ref, 'block');
      attachObjectTooltip(blockVisual, item.ref, 'block');
      visual.appendChild(blockVisual);
    } else {
      const name=document.createElement('div'); name.className='shop-item-name'; name.textContent=item.name;
      visual.appendChild(name);
    }
    if(item.kind==='power') attachCardTooltip(visual, POWER_CARD_DEFS[item.ref.defId]);
    if(item.kind==='upgrade') attachCardTooltip(visual, UPGRADE_POOL.find(x=>x.id===item.ref.defId));
    row.appendChild(visual);

    const actions=document.createElement('div'); actions.className='shop-item-actions';
    const buy=document.createElement('button'); buy.textContent=item.bought?'Đã mua':'Mua';
    buy.disabled=item.bought||state.money<shopPrice(item.price)||((item.kind==='power'||item.kind==='upgrade')&&state.cardHand.length>=getMaxCardHand());
    buy.addEventListener('click',()=>buyCommonShop(item));
    actions.appendChild(buy);
    if(item.kind==='power'||item.kind==='upgrade'){
      const use=document.createElement('button'); use.className='use-btn'; use.textContent='Dùng';
      use.disabled=item.bought||state.money<shopPrice(item.price)||(item.kind==='power'&&state.cardHand.length>=getMaxCardHand());
      use.addEventListener('click',()=>useCommonShop(item));
      actions.appendChild(use);
    }
    row.appendChild(actions);
    commonGrid.appendChild(row);
  });
  common.appendChild(commonGrid);
  const rr=document.createElement('div'); rr.style.cssText='display:flex;justify-content:center;margin-top:8px;';
  const rb=document.createElement('button'); rb.textContent=`Đổi hàng (${formatMoney(state.commonRerollCost)})`;
  rb.disabled=state.money<state.commonRerollCost;
  rb.addEventListener('click',rerollShop);
  rr.appendChild(rb); common.appendChild(rr); panel.appendChild(common);

  const lower=document.createElement('div'); lower.className='shop-lower';
  const buff=document.createElement('div'); buff.className='shop-section'; buff.innerHTML='<h3>Thẻ buff</h3>';
  const br=document.createElement('div'); br.className='shop-card';
  const bo=state.shopBuff;
  const buffCost=bo.id==='discount'?bo.cost:shopPrice(bo.cost);
  br.innerHTML=`<div class="shop-price">$${buffCost}</div><div class="desc"><span class="name">${bo.name}</span>${bo.desc}</div>`;
  const buffActions=document.createElement('div'); buffActions.className='shop-item-actions';
  const bb=document.createElement('button'); bb.textContent=bo.bought?'Đã mua':'Mua'; bb.disabled=bo.bought||state.money<buffCost;
  bb.addEventListener('click',()=>{
    state.money-=buffCost;
    bo.apply();
    bo.bought=true;
    markBuffOwned(bo.id);
    state.shopBuffBought=true;
    moneyValEl.textContent=formatMoney(state.money);
    renderShop();
    scheduleAutoSave();
  });
  buffActions.appendChild(bb); br.appendChild(buffActions); buff.appendChild(br); lower.appendChild(buff);

  const gach=document.createElement('div'); gach.className='shop-section'; gach.innerHTML='<h3>Các hộp gacha</h3>';
  const gachGrid=document.createElement('div'); gachGrid.className='shop-gacha-grid';
  state.gachaStock.forEach(g=>gachGrid.appendChild(renderGachaBoxShop(g)));
  gach.appendChild(gachGrid); lower.appendChild(gach); panel.appendChild(lower);

  const cont=document.createElement('div'); cont.className='shop-continue';
  const cb=document.createElement('button'); cb.className='gold'; cb.textContent=`→ Màn ${formatNumber(state.level+1)}`;
  cb.addEventListener('click',()=>{
    if(cb.dataset.busy==='1') return;
    cb.dataset.busy='1';
    state.commonItems=null;
    state.gachaStock=null;
    state.commonRerollCost=3;
    newLevel();
  });
  cont.appendChild(cb); panel.appendChild(cont);
  shopOverlayEl.appendChild(panel);
}

function openShop(){
  if(!state.commonItems) state.commonItems=makeCommonStock();
  if(!state.gachaStock) state.gachaStock=makeGachaStock();
  if(!state.shopBuff) state.shopBuff={...pickAvailableBuff(),bought:false};
  activeRenderShop = renderShop;
  shopOverlayEl.classList.remove('hidden');
  shopOverlayEl.classList.remove('targeting-pass-through');
  cardHandEl.classList.add('shop-active');
  renderShop();
}

