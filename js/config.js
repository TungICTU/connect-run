// ---------- constants ----------
const N_DIR=0,E_DIR=1,S_DIR=2,W_DIR=3;
const DIR_NAMES = ['N','E','S','W'];
const DIR_VEC = { 0:[0,-1], 1:[1,0], 2:[0,1], 3:[-1,0] };
const opposite = d => (d+2)%4;

const BASE_SIDES = {
  straight: [E_DIR, W_DIR],
  L: [N_DIR, E_DIR],
  T: [N_DIR, E_DIR, S_DIR],
  plus: [N_DIR, E_DIR, S_DIR, W_DIR]
};
function openSides(block){ return BASE_SIDES[block.type].map(s => (s + block.rotation) % 4); }

const BAG_RECIPE = { straight:8, L:8, T:6, plus:3 };
const BASE_MAX_BALLS = 5;
const HAND_SIZE = 3;
const MAX_CARD_HAND = 5;

const BLOCK_PROPS = ['steel','stone','gold','wood','glass'];
const BALL_PROPS  = ['steel','striped','grid','gold','glass'];
const ENHANCEMENTS = ['holo','spark','invert'];

const PROP_COLOR = { steel:'#b8c4cf', stone:'#9c8768', gold:'#f2c94c', wood:'#c98a4b', glass:'#8fe3e0', striped:'#e26fa6', grid:'#7c8cf8' };
const PROP_LABEL = { steel:'Thép', stone:'Đá', gold:'Vàng', wood:'Gỗ', glass:'Kính', striped:'Sọc', grid:'Kẻ' };
const PROP_INITIAL = { steel:'T', stone:'Đ', gold:'V', wood:'G', glass:'K', striped:'S', grid:'K' };
const ENH_LABEL = { holo:'Lấp lánh', spark:'Đa sắc', invert:'Âm bản' };
const ENH_COLOR = { holo:'#c792ea', spark:'#ffd166', invert:'#ff6b9d' };
const ENH_INITIAL = { holo:'L', spark:'Đ', invert:'Â' };
const TYPE_LABEL = { straight:'Thẳng', L:'Chữ L', T:'Chữ T', plus:'Dấu Cộng' };


// ---------- hover tooltip content ----------
const LEVEL_COLORS = ['#ffffff','#5b9bff','#6fcf97','#f2c94c','#f2994a','#eb5757','#bb6bd9']; // Lv1..Lv7+
const levelColor = lv => LEVEL_COLORS[Math.min(lv,7)-1];
const BLOCK_PROP_DESC = {
  steel:'Nhân 1.5x điểm khi bóng vào lỗ cho mỗi khối thép bóng đi qua',
  stone:'+50 điểm khi bóng thoát khối',
  wood:'+5 tỉ lệ cộng điểm khi bóng thoát khối',
  glass:'Nhân 1.5x điểm hiện tại; 10% khối vỡ sau khi bóng thoát',
  gold:'Sau khi thắng màn: +3$ cho mỗi khối vàng còn trên bảng',
};
const BLOCK_ENH_DESC = {
  holo:'+50 điểm khi bóng thoát khối',
  spark:'Nhân x1.5 điểm bóng chứa khi bóng thoát khối, rồi giảm bởi 0.05, tối thiểu x1',
  invert:'Cho phép khối sinh bóng thêm 1 lần trong một lần bắn',
};
const BALL_PROP_DESC = {
  striped:'Nhân 1.5x điểm mà khối cho bóng thoát ra',
  grid:'+10 điểm mỗi lần bóng thoát khối',
  glass:'Nhân 2x điểm mỗi lần bóng thoát khối; 10% bóng vỡ sau mỗi lần thoát khối; 10% mất bóng khi bóng kính cuối cùng về lỗ',
  steel:'Nhân 1.5x điểm khi bóng vào lỗ',
  gold:'+1$ khi bóng vào lỗ',
};
const BALL_ENH_DESC = {
  holo:'+50 điểm mỗi lần bóng thoát khối',
  spark:'Nhân x1.5 điểm bóng chứa mỗi khi bóng thoát một khối mà bóng chưa từng thoát qua',
  invert:'Khi bóng bị mất, vẫn được tính 1/2 số điểm bóng đang chứa vào điểm màn',
};

function blockTooltip(block){
  const level = ((state.typeBonus[block.type]||0)/5) + 1;
  return {
    title:TYPE_LABEL[block.type],
    level,
    lines:[`Số điểm cho khi bóng đi ra: ${formatNumber((10+state.baseRateBonus)+(state.typeBonus[block.type]||0))}`],
    property:block.property ? { label:PROP_LABEL[block.property], color:PROP_COLOR[block.property], desc:BLOCK_PROP_DESC[block.property] } : null,
    enhancement:block.enhancement ? { label:ENH_LABEL[block.enhancement], id:block.enhancement, color:ENH_COLOR[block.enhancement], desc:BLOCK_ENH_DESC[block.enhancement] } : null,
    core:block.core ? { label:CORE_LABEL[block.core.id], id:block.core.id, color:CORE_COLOR[block.core.id], desc:CORE_DEFS[block.core.id]?.desc || '', count:coreHasCount(block.core) ? block.core.count : null } : null
  };
}
function ballTooltip(b){
  const level = ((state.baseRateBonus||0)/2) + 1;
  return {
    title:'Bóng',
    level,
    lines:[
      `Số điểm bóng chứa: ${formatNumber(50+state.startBonus)}`,
      `Tỉ lệ cộng: ${formatNumber(10)}${state.baseRateBonus>0?`(+${formatNumber(state.baseRateBonus)})`:''}/khối`,
    ],
    property:b.property ? { label:PROP_LABEL[b.property], color:PROP_COLOR[b.property], desc:BALL_PROP_DESC[b.property] } : null,
    enhancement:b.enhancement ? { label:ENH_LABEL[b.enhancement], id:b.enhancement, color:ENH_COLOR[b.enhancement], desc:BALL_ENH_DESC[b.enhancement] } : null
  };
}

const hoverTipEl = document.createElement('div'); hoverTipEl.className='hover-tip hidden';
document.body.appendChild(hoverTipEl);

let debugHoverTarget = null;
function markDebugTarget(el, obj, kind){ el.__debugTarget = {el, obj, kind}; return el; }
function debugDescribeTarget(target){
  if(!target || !target.obj) return '<span class="debug-none">Chưa có khối hoặc bóng nào dưới con trỏ.</span>';
  const obj=target.obj;
  const label=target.kind==='block' ? (TYPE_LABEL[obj.type]||'Khối') : 'Bóng';
  const coreText = target.kind==='block' && obj.core ? `${CORE_LABEL[obj.core.id]}${coreHasCount(obj.core) ? ` (${obj.core.count})` : ''}` : 'Không có';
  return `<strong>${label}</strong><br>Đặc điểm: ${obj.property ? PROP_LABEL[obj.property] : 'Không có'}<br>Enhancement: ${obj.enhancement ? ENH_LABEL[obj.enhancement] : 'Không có'}<br>Lõi: ${coreText}`;
}
function debugRefreshSelects(){
  const ps=document.getElementById('debugPropertySelect'), es=document.getElementById('debugEnhSelect'), cs=document.getElementById('debugCoreSelect'), ab=document.getElementById('debugApplyTargetBtn');
  ps.innerHTML=''; es.innerHTML=''; cs.innerHTML='';
  if(!debugHoverTarget){ ps.disabled=true; es.disabled=true; cs.disabled=true; ab.disabled=true; return; }
  const props=debugHoverTarget.kind==='block'?BLOCK_PROPS:BALL_PROPS;
  const n=document.createElement('option'); n.value=''; n.textContent='Không có đặc điểm'; ps.appendChild(n);
  props.forEach(x=>{const o=document.createElement('option');o.value=x;o.textContent=PROP_LABEL[x];ps.appendChild(o);});
  const ne=document.createElement('option'); ne.value=''; ne.textContent='Không có enhancement'; es.appendChild(ne);
  ENHANCEMENTS.forEach(x=>{const o=document.createElement('option');o.value=x;o.textContent=ENH_LABEL[x];es.appendChild(o);});
  const noneCore=document.createElement('option'); noneCore.value=''; noneCore.textContent='Không có lõi'; cs.appendChild(noneCore);
  if(debugHoverTarget.kind==='block') CORE_IDS.forEach(id=>{ const o=document.createElement('option'); o.value=id; o.textContent=CORE_LABEL[id]; cs.appendChild(o); });
  cs.value=debugHoverTarget.kind==='block' ? (debugHoverTarget.obj.core?.id||'') : '';
  cs.disabled=debugHoverTarget.kind!=='block';
  ps.value=debugHoverTarget.obj.property||''; es.value=debugHoverTarget.obj.enhancement||''; ps.disabled=false; es.disabled=false; ab.disabled=false;
}
function debugUpdateTargetVisual(target){
  if(!target?.el?.isConnected) return;
  const el=target.el;
  if(target.kind==='block'){
    if(el.matches('.cell,.hand-slot,.inventory-item')) renderBlockArms(el,target.obj);
    else { const mini=el.querySelector('.mini-block'); if(mini) mini.outerHTML=renderMiniBlockMarkup(target.obj); }
  } else {
    if(el.classList.contains('ball-chip')){ el.dataset.prop=target.obj.property||''; el.dataset.enh=target.obj.enhancement||''; if(target.obj.property) el.style.setProperty('--prop-color',PROP_COLOR[target.obj.property]); else el.style.removeProperty('--prop-color'); }
    else { const chip=el.querySelector('.ball-chip,.mini-ball'); if(chip) chip.outerHTML=ballChipMarkup(target.obj); }
  }
}
function debugApplyTarget(){
  const t=debugHoverTarget; if(!t?.obj) return;
  const prop=document.getElementById('debugPropertySelect').value||null, enh=document.getElementById('debugEnhSelect').value||null;
  const coreId=document.getElementById('debugCoreSelect').value||null;
  t.obj.property=prop; t.obj.enhancement=enh;
  if(t.kind==='block') t.obj.core=coreId ? makeCore(coreId) : null;
  if(t.kind==='ball'){
    const pool=t.obj._id ? state.ballPool.find(b=>b._id===t.obj._id) : null;
    const q=t.obj._id ? state.ballQueue.find(b=>b._id===t.obj._id) : null;
    if(pool){ pool.property=prop; pool.enhancement=enh; }
    if(q){ q.property=prop; q.enhancement=enh; }
    if(pool || q){ syncBallMutationTargets([{obj:t.obj,kind:'ball'}]); }
    renderBallQueue();
    if(!shopOverlayEl.classList.contains('hidden')) renderShop();
    debugUpdateTargetVisual(t);
  } else {
    render();
    if(!shopOverlayEl.classList.contains('hidden')) renderShop();
    if(!inventoryOverlayEl.classList.contains('hidden')) openInventory();
  }
  document.getElementById('debugTargetInfo').innerHTML=debugDescribeTarget(t); debugRefreshSelects();
}
function createTooltipPill(info, type){
  const pill = document.createElement('span');
  pill.className = 'hover-tip-pill' + (type==='enhancement' ? ` enh-${info.id}` : '');
  pill.textContent = info.label;
  if(type==='property' || type==='core'){
    pill.style.background = info.color || 'var(--cyan)';
    pill.style.color = type==='core' && info.id==='yellow' ? '#071322' : '#fff';
  } else {
    pill.style.setProperty('--enh-color', info.color || 'var(--cyan)');
  }
  return pill;
}

function createTooltipDetail(info, type){
  const detail = document.createElement('div');
  detail.className='hover-tip-detail';
  const title = document.createElement('div');
  title.className='hover-tip-detail-title';
  title.appendChild(createTooltipPill(info, type));
  detail.appendChild(title);
  const desc = document.createElement('div');
  desc.className='hover-tip-detail-desc';
  desc.textContent=info.desc;
  detail.appendChild(desc);
  return detail;
}

function placeHoverTip(targetEl){
  if(hoverTipEl.classList.contains('hidden') || !targetEl?.isConnected) return;

  const targetRect = targetEl.getBoundingClientRect();
  const tipRect = hoverTipEl.getBoundingClientRect();
  const margin = 8;
  const gap = 10;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Preferred position: centered above the hovered element.
  let left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
  let top = targetRect.top - tipRect.height - gap;

  // If there is not enough room above, place it below instead.
  if(top < margin){
    top = targetRect.bottom + gap;
  }

  // Keep the entire tooltip inside the viewport horizontally.
  if(left < margin) left = margin;
  if(left + tipRect.width > viewportW - margin){
    left = viewportW - margin - tipRect.width;
  }

  // If neither above nor below fits completely, clamp vertically to the viewport.
  if(top + tipRect.height > viewportH - margin){
    top = Math.max(margin, viewportH - margin - tipRect.height);
  }

  hoverTipEl.style.left = Math.round(left) + 'px';
  hoverTipEl.style.top = Math.round(top) + 'px';
  hoverTipEl.style.transform = 'none';
}

function showHoverTip(targetEl, info){
  hoverTipEl._targetEl = targetEl;
  hoverTipEl.innerHTML = '';
  hoverTipEl.classList.remove('locked-tooltip-stack', 'debuff-tooltip-stack', 'hazard-tooltip');

  const main = document.createElement('div');
  main.className='hover-tip-main';

  const t = document.createElement('div');
  t.className='tip-title';
  const titleLeft = document.createElement('div');
  titleLeft.className='tip-title-left';
  const baseTitle = document.createElement('span');
  baseTitle.className='tip-title-base';
  baseTitle.textContent=info.title;
  titleLeft.appendChild(baseTitle);
  if(info.property) titleLeft.appendChild(createTooltipPill(info.property, 'property'));
  if(info.enhancement) titleLeft.appendChild(createTooltipPill(info.enhancement, 'enhancement'));
  if(info.core) titleLeft.appendChild(createTooltipPill(info.core, 'core'));
  t.appendChild(titleLeft);

  const levelEl=document.createElement('span');
  levelEl.className='tip-level';
  levelEl.textContent=`Lv.${info.level}`;
  levelEl.style.color=levelColor(info.level);
  t.appendChild(levelEl);
  main.appendChild(t);

  info.lines.forEach(line=>{
    const d = document.createElement('div');
    if(typeof line === 'string') d.textContent = line;
    else { d.textContent = line.text; d.style.color = line.color; }
    main.appendChild(d);
  });
  hoverTipEl.appendChild(main);

  if(info.property || info.enhancement || info.core){
    const details=document.createElement('div');
    details.className='hover-tip-details';
    if(info.property) details.appendChild(createTooltipDetail(info.property, 'property'));
    if(info.enhancement) details.appendChild(createTooltipDetail(info.enhancement, 'enhancement'));
    if(info.core) details.appendChild(createTooltipDetail(info.core, 'core'));
    hoverTipEl.appendChild(details);
  }

  hoverTipEl.classList.remove('hidden');
  placeHoverTip(targetEl);
}
function hideHoverTip(){ hoverTipEl.classList.add('hidden'); hoverTipEl._targetEl = null; }
window.addEventListener('resize', ()=>{
  if(!hoverTipEl.classList.contains('hidden') && hoverTipEl._targetEl) placeHoverTip(hoverTipEl._targetEl);
});
window.addEventListener('scroll', ()=>{
  if(!hoverTipEl.classList.contains('hidden') && hoverTipEl._targetEl) placeHoverTip(hoverTipEl._targetEl);
}, true);

function attachObjectTooltip(el, obj, kind){
  el.addEventListener('mouseenter', ()=> showHoverTip(el, kind==='ball' ? ballTooltip(obj) : blockTooltip(obj)));
  el.addEventListener('mouseleave', hideHoverTip);
}

function showSimpleHoverTip(targetEl, titleText, bodyText, extraClass=''){ 
  hoverTipEl._targetEl = targetEl;
  hoverTipEl.innerHTML='';
  hoverTipEl.classList.remove('locked-tooltip-stack', 'debuff-tooltip-stack', 'hazard-tooltip');
  const panel=document.createElement('div');
  panel.className='hover-tip-main';
  if(extraClass) hoverTipEl.classList.add(extraClass);
  const title=document.createElement('div');
  title.className='tip-title';
  title.textContent=titleText;
  panel.appendChild(title);
  const line=document.createElement('div');
  line.textContent=bodyText;
  panel.appendChild(line);
  hoverTipEl.appendChild(panel);
  hoverTipEl.classList.remove('hidden');
  placeHoverTip(targetEl);
}

function blackBlockTooltip(el){
  el.addEventListener('mouseenter', ()=>showSimpleHoverTip(el, 'Vật cản', 'Không thể đặt khối lên ô này', 'hazard-tooltip'));
  el.addEventListener('mouseleave', hideHoverTip);
}

function attachCardTooltip(el, def){
  if(!def) return;
  el.addEventListener('mouseenter', ()=>showSimpleHoverTip(el, def.name, def.desc));
  el.addEventListener('mouseleave', hideHoverTip);
}

function ballChipMarkup(b, extraClass=''){
  const prop=b?.property||'';
  const enh=b?.enhancement||'';
  return `<div class="ball-chip shop-ball-preview${extraClass?` ${extraClass}`:''}" data-prop="${prop}" data-enh="${enh}"></div>`;
}

const GACHA_TIERS = [
  { key:'small', label:'Nhỏ', cost:0, options:3, picks:1 },
  { key:'large', label:'Lớn', cost:0, options:5, picks:1 },
  { key:'mega',  label:'Siêu lớn', cost:0, options:5, picks:2 },
];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rollProp(list, chance){ return Math.random() < chance ? pick(list) : null; }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
let _uid = 1;
function cardUid(){ return 'c'+(_uid++); }


// ---------- upgrade & buff & power card defs ----------
const UPGRADE_POOL = [
  { id:'base', name:'Nâng cấp bóng cơ bản', desc:'+10 điểm bóng chứa ban đầu và +2 điểm mỗi lần bóng thoát block (mọi bóng)', cost:5, apply(){ state.startBonus += 10; state.baseRateBonus += 2; } },
  { id:'straight', name:'Nâng cấp khối Thẳng', desc:'+5 điểm khi bóng thoát khối Thẳng', cost:5, apply(){ state.typeBonus.straight += 5; } },
  { id:'L', name:'Nâng cấp khối chữ L', desc:'+5 điểm khi bóng thoát khối L', cost:5, apply(){ state.typeBonus.L += 5; } },
  { id:'T', name:'Nâng cấp khối chữ T', desc:'+5 điểm khi bóng thoát khối T', cost:5, apply(){ state.typeBonus.T += 5; } },
  { id:'plus', name:'Nâng cấp khối Dấu Cộng', desc:'+5 điểm khi bóng thoát khối +', cost:5, apply(){ state.typeBonus.plus += 5; } },
];

const BUFF_POOL = [
  { id:'balls', name:'Tay nhanh', desc:'+1 giới hạn số bóng bắn mỗi màn, vĩnh viễn', cost:12, apply(){ state.maxBallsBonus += 1; } },
  { id:'start', name:'Khởi động', desc:'Mọi bóng bắt đầu với +5 điểm nền, vĩnh viễn', cost:12, apply(){ state.startBonus += 5; } },
  { id:'interest', name:'Giàu có', desc:'Tăng giới hạn số tiền lãi có thể nhận được +10$', cost:12, apply(){ state.interestCapBonus += 10; } },
  { id:'trash', name:'Thùng rác', desc:'+1 giới hạn loại bỏ mỗi màn', cost:12, apply(){ state.discardBonus += 1; } },
  { id:'big_hand', name:'Tay lớn', desc:'+1 khối có thể cầm trong tay', cost:12, apply(){ state.handSizeBonus += 1; } },
  { id:'discount', name:'Hạ giá', desc:'Giảm 25% giá mua các vật phẩm trong cửa hàng', cost:12, apply(){ state.discountBonus = true; } },
  { id:'empty', name:'Rỗng', desc:'Không có chức năng gì cả', cost:12, apply(){} },
];

function getOwnedBuffIds(){ return Array.isArray(state?.ownedBuffIds) ? state.ownedBuffIds : []; }
function getMaxHandSize(){ return HAND_SIZE + (state?.handSizeBonus || 0); }
function getMaxCardHand(){ return MAX_CARD_HAND; }
function getMaxDiscards(){ return 3 + (state?.discardBonus || 0); }
function isBuffOwned(id){ return getOwnedBuffIds().includes(id); }
function markBuffOwned(id){ if(id==='empty' || isBuffOwned(id)) return; state.ownedBuffIds.push(id); }
function pickAvailableBuff(){
  const available=BUFF_POOL.filter(b=>b.id!=='empty' && !isBuffOwned(b.id));
  return available.length ? pick(available) : BUFF_POOL.find(b=>b.id==='empty');
}
function shopPrice(base){
  const n=Number(base)||0;
  return state?.discountBonus ? Math.max(1,Math.round(n*0.75)) : n;
}

const PROPERTY_CARD_TARGET_KIND = { steel:'both', stone:'block', gold:'both', wood:'block', glass:'both', striped:'ball', grid:'ball' };
const POWER_CARD_DEFS = {};
['steel','stone','gold','wood','glass','striped','grid'].forEach(p=>{
  const kind = PROPERTY_CARD_TARGET_KIND[p];
  const kindLabel = kind==='ball' ? 'bóng' : (kind==='block' ? 'khối' : 'khối hoặc bóng');
  POWER_CARD_DEFS['prop_'+p] = {
    id:'prop_'+p, name:`Thẻ ${PROP_LABEL[p]}`,
    desc:`Biến 1 ${kindLabel} thành thuộc tính ${PROP_LABEL[p]}`,
    cost: 5, targetKind: kind, targetCount:1,
    use(targets){ targets[0].obj.property = p; }
  };
});
POWER_CARD_DEFS['money'] = { id:'money', name:'Thẻ tiền', desc:'Nhận thêm một lượng tiền bằng số tiền hiện có, tối đa +25$', cost:5, targetKind:null, targetCount:0,
  use(){ const bonus=Math.min(Math.max(0,state.money),25); state.money += bonus; moneyValEl.textContent=formatMoney(state.money); } };
POWER_CARD_DEFS['swap'] = { id:'swap', name:'Thẻ hoán đổi', desc:'Chọn 2 khối HOẶC 2 bóng, hoán đổi thuộc tính + enhancement', cost:5, targetKind:'swap', targetCount:2,
  use(targets){ const a=targets[0].obj, b=targets[1].obj; const pa=a.property, ea=a.enhancement; a.property=b.property; a.enhancement=b.enhancement; b.property=pa; b.enhancement=ea; } };
POWER_CARD_DEFS['magic'] = { id:'magic', name:'Thẻ ma thuật', desc:'Chọn 1 khối hoặc bóng, thêm enhancement ngẫu nhiên', cost:5, targetKind:'both', targetCount:1,
  use(targets){ targets[0].obj.enhancement = pick(ENHANCEMENTS); } };
POWER_CARD_DEFS['clone'] = { id:'clone', name:'Thẻ nhân bản', desc:'Chọn 1 khối, tạo thêm 1 khối giống hệt cho túi đồ màn sau', cost:5, targetKind:'block', targetCount:1,
  use(targets){ const o=targets[0].obj; state.pendingBlocks.push({type:o.type, rotation:0, property:o.property, enhancement:o.enhancement, core:cloneCore(o.core)}); } };
POWER_CARD_DEFS['core'] = { id:'core', name:'Thẻ lõi', desc:'Chọn 1 khối chưa có lõi, gắn 1 lõi ngẫu nhiên cho khối đó', cost:5, targetKind:'block', targetCount:1,
  targetPredicate:(obj)=>!obj?.core,
  use(targets){ targets[0].obj.core = randomCore(); } };
POWER_CARD_DEFS['core_upgrade'] = { id:'core_upgrade', name:'Thẻ tăng cấp lõi', desc:'Chọn 1 khối có lõi chứa số đếm, tăng số đếm của lõi +1', cost:5, targetKind:'block', targetCount:1,
  targetPredicate:(obj)=>coreHasCount(obj?.core),
  use(targets){ const core=targets[0].obj.core; if(coreHasCount(core)) core.count = Math.max(1, Math.floor(Number(core.count)||1) + 1); } };
POWER_CARD_DEFS['annihilate'] = { id:'annihilate', name:'Thẻ triệt tiêu', desc:'Loại bỏ tối đa 2 khối được chọn trên tay hoặc bảng chơi', cost:5, targetKind:'block', targetCount:2, targetMinCount:1, manualConfirm:true,
  use(targets){
    const selected = new Set(targets.map(t=>t.obj));
    state.hand = state.hand.filter(block=>!selected.has(block));
    if(state.cells){
      for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
        if(selected.has(state.cells[r][c].block)) state.cells[r][c].block = null;
      }
    }
    refillHand();
  } };
POWER_CARD_DEFS['breed'] = { id:'breed', name:'Thẻ sinh sản', desc:'Tạo ra 2 thẻ sức mạnh ngẫu nhiên và đưa vào tay', cost:5, targetKind:null, targetCount:0,
  use(){
    const defs=shuffle(Object.values(POWER_CARD_DEFS).filter(d=>d.id!=='copy'));
    const free=Math.max(0,getMaxCardHand()-state.cardHand.length);
    for(let i=0;i<Math.min(2,free);i++){ const d=defs[i%defs.length]; state.cardHand.push({id:cardUid(),kind:'power',defId:d.id}); }
  } };
POWER_CARD_DEFS['copy'] = { id:'copy', name:'Thẻ sao chép', desc:'Đưa vào tay thẻ sức mạnh hoặc thẻ nâng cấp gần nhất đã dùng', cost:5, targetKind:null, targetCount:0,
  use(){
    const last=state.lastUsedCard;
    if(!last || state.cardHand.length>=getMaxCardHand()) return;
    state.cardHand.push({id:cardUid(),kind:last.kind,defId:last.defId});
  } };

