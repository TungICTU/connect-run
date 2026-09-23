// ---------- boss system ----------
// Every 3rd level is a boss level. Boss rules are persistent for that level only.
// All boss data that must survive a reload lives in state.boss/state.bossHistory;
// transient visual/runtime state lives on block/cell objects and is cleared when
// the level changes.

const BOSS_BASIC_IDS = [
  'line','L','plus','T','silencer','magician','disabled'
];

const BOSS_DEFS = {
  line: {
    id:'line', name:'The Line', color:'#f2c94c',
    desc:'Giảm 50% giá trị hiệu ứng của các khối Thẳng.',
    type:'straight'
  },
  L: {
    id:'L', name:'The L', color:'#2f80ed',
    desc:'Giảm 50% giá trị hiệu ứng của các khối Chữ L.',
    type:'L'
  },
  plus: {
    id:'plus', name:'The Plus', color:'#f2994a',
    desc:'Giảm 50% giá trị hiệu ứng của các khối Dấu Cộng.',
    type:'plus'
  },
  T: {
    id:'T', name:'The T', color:'#6fcf97',
    desc:'Giảm 50% giá trị hiệu ứng của các khối Chữ T.',
    type:'T'
  },
  locker: {
    id:'locker', name:'The Locker', color:'#9b51e0',
    desc:'Thêm ngẫu nhiên 2–5 ô khóa vào bảng khi bắt đầu màn.'
  },
  debuffer: {
    id:'debuffer', name:'The Debuffer', color:'#8b6f47',
    desc:'Thêm ngẫu nhiên 2–5 ô debuff vào bảng khi bắt đầu màn.'
  },
  nerfer: {
    id:'nerfer', name:'The Nerfer', color:'#f7b267',
    desc:'Thêm ngẫu nhiên 2–5 ô giảm sức mạnh vào bảng khi bắt đầu màn.'
  },
  silencer: {
    id:'silencer', name:'The Silencer', color:'#050505',
    desc:'Mỗi lần rút một tay mới, 1 khối ngẫu nhiên trong tay bị câm; hiệu ứng đi theo chính khối đó.'
  },
  thief: {
    id:'thief', name:'The Thief', color:'#e74c3c',
    desc:'Chọn 1 loại khối. Mỗi khối vật lý thuộc loại đó chỉ bị trừ $1 ở lần đầu bóng đi qua; trạng thái đi theo chính khối đó.'
  },
  illusioner: {
    id:'illusioner', name:'The Illusioner', color:'#075985',
    desc:'Mỗi lần rút một tay mới, 0–3 khối ngẫu nhiên bị ẩn cho đến khi được đặt lên bảng; hiệu ứng đi theo chính khối đó.'
  },
  magician: {
    id:'magician', name:'The Magician', color:'#eb6ba8',
    desc:'Bắt đầu màn với 0 lượt loại bỏ khối.'
  },
  disabled: {
    id:'disabled', name:'The Disabled', color:'#808080',
    desc:'Giảm sức chứa tay đi 1 khối trong suốt màn.'
  },
  dart: {
    id:'dart', name:'The Dart', color:'#f97316',
    desc:'Chỉ được bắn 1 bóng trong toàn bộ màn.'
  },
  rock: {
    id:'rock', name:'The Rock', color:'#4b1f72',
    desc:'Mục tiêu điểm của màn này được nhân 2.'
  },
  assassin: {
    id:'assassin', name:'The Assassin', color:'#8b1e3f',
    desc:'1–2 ô trở thành mục tiêu; sau mỗi shot, khối trong ô mục tiêu bị triệt tiêu rồi mục tiêu chuyển sang ô khác.'
  },
  hacker: {
    id:'hacker', name:'The Hacker', color:'#9be7a3',
    desc:'5 ô bị điều khiển. Trước mỗi lần bắn, khối trong các ô hiện tại bị xoay ngẫu nhiên; sau shot, 5 ô mới được chọn.'
  },
  parasite: {
    id:'parasite', name:'The Parasite', color:'#f3a6c8',
    desc:'1–3 ô trở thành hiệu ứng bất lợi khi bắt đầu; sau mỗi shot thêm 1–3 ô bất lợi mới.'
  },
};

const BOSS_ALL_IDS = Object.keys(BOSS_DEFS);
const BOSS_NERF_CORE_UNAFFECTED = new Set(['red','blue','purple','pink']);
const BOSS_ADVERSE_KEYS = ['locked','debuff','nerf','controlled','assassinTarget'];
const BOSS_CONTROLLED_COLOR = '#c792ea';
const BOSS_THIEF_TYPES = ['straight','L','T','plus'];

function hasAssignedBossForLevel(level){
  const id=state?.bossHistory?.[String(Number(level)||0)];
  return !!BOSS_DEFS[id];
}

function getBossDefForLevel(level){
  const lv=String(Number(level)||0);
  const def=getBossDef(state?.bossHistory?.[lv]);
  if(!def) return null;
  const meta=state?.bossHistoryMeta?.[lv];
  if(def.id==='thief' && meta?.thiefType) return {...def, thiefType:meta.thiefType};
  if(state?.boss?.level===Number(level) && state.boss.id==='thief' && state.boss.thiefType) return {...def, thiefType:state.boss.thiefType};
  return def;
}

function getDefeatedBossSet(){
  if(!state) return new Set();
  if(!Array.isArray(state.defeatedBosses)) state.defeatedBosses=[];
  state.defeatedBosses = [...new Set(state.defeatedBosses.filter(id=>!!BOSS_DEFS[id]))];
  return new Set(state.defeatedBosses);
}

function allBossesDefeated(){
  return getDefeatedBossSet().size>=BOSS_ALL_IDS.length;
}

function markBossDefeated(id){
  if(!id || !BOSS_DEFS[id] || !state) return false;
  const defeated=getDefeatedBossSet();
  if(defeated.has(id)) return false;
  state.defeatedBosses.push(id);
  // Any future boss entries carrying a defeated identity are invalid and will
  // be re-rolled below. Past/completed entries are left intact for the bar.
  ensureBossHistoryThrough(Math.max(Number(state.level)||1,(Number(state.level)||1)+4));
  scheduleAutoSave?.();
  return true;
}

function clearBossEffectsForDebug(){
  if(!state) return;
  clearBossTransientBlockFlags();
  const boss=state.boss;
  if(boss?.adverseCells && Array.isArray(boss.adverseCells)){
    for(const item of boss.adverseCells){
      const [r,c,kind]=String(item).split(',');
      const rr=Number(r), cc=Number(c);
      if(Number.isInteger(rr)&&Number.isInteger(cc)&&['locked','debuff','nerf'].includes(kind)){
        const cell=state.cells?.[rr]?.[cc];
        if(cell) cell[kind]=false;
      }
    }
  }
  if(boss?.controlledCells) for(const key of boss.controlledCells){
    const [r,c]=String(key).split(',').map(Number);
    if(Number.isInteger(r)&&Number.isInteger(c)&&state.cells?.[r]?.[c]) state.cells[r][c].controlled=false;
  }
  if(boss?.assassinTargets) for(const key of boss.assassinTargets){
    const [r,c]=String(key).split(',').map(Number);
    if(Number.isInteger(r)&&Number.isInteger(c)&&state.cells?.[r]?.[c]) state.cells[r][c].assassinTarget=false;
  }
}

function debugSetBossForLevel(level,id){
  if(!state || !BOSS_DEFS[id]) return false;
  const lv=Math.max(1,Math.floor(Number(level)||1));
  if(!state.bossHistory || typeof state.bossHistory!=='object') state.bossHistory={};
  state.bossHistory[String(lv)]=id;
  if(!state.bossDebugOverrides || typeof state.bossDebugOverrides!=='object') state.bossDebugOverrides={};
  state.bossDebugOverrides[String(lv)]=id;
  state.bossHistoryMeta = (state.bossHistoryMeta && typeof state.bossHistoryMeta==='object') ? state.bossHistoryMeta : {};
  if(id==='thief') state.bossHistoryMeta[String(lv)]={thiefType:pick(BOSS_THIEF_TYPES)};
  else delete state.bossHistoryMeta[String(lv)];
  if(lv===Number(state.level)){
    clearBossEffectsForDebug();
    ensureBossForLevel(lv);
    if(state.boss){
      state.target=getBossTarget(computeTarget(lv));
      state.discardsLeft=getMaxDiscards();
      if(state.ballsFired===0) state.ballQueue=makeBallQueue();
      applyBossStartEffects();
      applyBossHandEffects();
    }
  }
  ensureBossHistoryThrough(Math.max(lv,(Number(state.level)||1)+4));
  render?.();
  renderLocationBar?.(false);
  renderTargetBanner?.();
  scheduleAutoSave?.();
  return true;
}

function debugRemoveBossForLevel(level){
  if(!state) return false;
  const lv=Math.max(1,Math.floor(Number(level)||1));
  if(!state.bossHistory || typeof state.bossHistory!=='object') state.bossHistory={};
  delete state.bossHistory[String(lv)];
  if(state.bossHistoryMeta) delete state.bossHistoryMeta[String(lv)];
  if(!state.bossDebugOverrides || typeof state.bossDebugOverrides!=='object') state.bossDebugOverrides={};
  state.bossDebugOverrides[String(lv)]=null;
  if(lv===Number(state.level)){
    clearBossEffectsForDebug();
    state.boss=null;
    state.target=computeTarget(lv);
    state.discardsLeft=getMaxDiscards();
    if(state.ballsFired===0) state.ballQueue=makeBallQueue();
  }
  ensureBossHistoryThrough(Math.max(lv,(Number(state.level)||1)+4));
  render?.();
  renderLocationBar?.(false);
  renderTargetBanner?.();
  scheduleAutoSave?.();
  return true;
}

function isBossLevel(level){
  const n=Number(level)||0;
  return n>0 && n%3===0;
}

function getBossDef(id){ return id ? (BOSS_DEFS[id] || null) : null; }
function getBossDisplayDescription(boss){
  if(!boss) return '';
  if(boss.id==='thief') {
    const typeLabel=TYPE_LABEL[boss.thiefType] || 'khối';
    return `Trừ $1 với mỗi khối ${typeLabel} mà bóng đi qua.`;
  }
  return boss.desc || '';
}
function isCurrentBoss(id){ return !!state?.boss?.id && state.boss.id===id; }

function bossRandomInt(min,max){
  return min + Math.floor(Math.random()*(max-min+1));
}

function pickBossIdForLevel(level, options={}){
  const lv=Number(level)||0;
  const defeated=getDefeatedBossSet();
  if(allBossesDefeated()){
    const pool = lv<=6 ? BOSS_BASIC_IDS : BOSS_ALL_IDS;
    return pick(pool);
  }

  const basePool = lv<=6 ? BOSS_BASIC_IDS : BOSS_ALL_IDS;
  const used = new Set(options.usedIds || []);
  let pool = basePool.filter(id=>!defeated.has(id) && !used.has(id));
  if(!pool.length) pool = basePool.filter(id=>!defeated.has(id));
  if(!pool.length) pool = BOSS_ALL_IDS.filter(id=>!defeated.has(id) && !used.has(id));
  if(!pool.length) pool = BOSS_ALL_IDS.filter(id=>!defeated.has(id));
  if(!pool.length) pool = BOSS_ALL_IDS;
  return pick(pool);
}

// Pre-roll visible future Boss nodes so the location bar can show their real
// colors/names before the player reaches those levels. Before every Boss has
// been defeated, the scheduler avoids both already-defeated Bosses and Bosses
// already assigned to another future Boss level.
function ensureBossHistoryThrough(endLevel){
  if(!state) return;
  if(!state.bossHistory || typeof state.bossHistory!=='object') state.bossHistory={};
  if(!Array.isArray(state.defeatedBosses)) state.defeatedBosses=[];
  if(!state.bossHistoryMeta || typeof state.bossHistoryMeta!=='object') state.bossHistoryMeta={};
  const end=Math.max(1,Number(endLevel)||1);
  const current=Math.max(1,Number(state.level)||1);
  const defeated=getDefeatedBossSet();
  const allDefeated=defeated.size>=BOSS_ALL_IDS.length;
  const usedFuture=new Set();

  for(let level=3;level<=end;level+=3){
    const key=String(level);
    const existing=BOSS_DEFS[state.bossHistory[key]] ? state.bossHistory[key] : null;
    const isPast=level<=current;
    const hasDebugOverride=!!state.bossDebugOverrides && Object.prototype.hasOwnProperty.call(state.bossDebugOverrides,key);

    // Past/current history is preserved for deterministic location rendering.
    // Debug overrides are also preserved verbatim; a null override explicitly
    // suppresses the normally scheduled Boss for this level.
    if(hasDebugOverride){
      if(existing) usedFuture.add(existing);
      continue;
    }
    if(isPast && existing){
      usedFuture.add(existing);
      continue;
    }

    if(allDefeated){
      if(!existing) state.bossHistory[key]=pickBossIdForLevel(level);
      if(state.bossHistory[key]==='thief' && !state.bossHistoryMeta[key]?.thiefType) state.bossHistoryMeta[key]={thiefType:pick(BOSS_THIEF_TYPES)};
      usedFuture.add(state.bossHistory[key]);
      continue;
    }

    if(existing && !defeated.has(existing) && !usedFuture.has(existing)){
      if(existing==='thief' && !state.bossHistoryMeta[key]?.thiefType) state.bossHistoryMeta[key]={thiefType:pick(BOSS_THIEF_TYPES)};
      usedFuture.add(existing);
      continue;
    }

    const id=pickBossIdForLevel(level,{usedIds:usedFuture});
    state.bossHistory[key]=id;
    if(id==='thief') state.bossHistoryMeta[key]={thiefType:pick(BOSS_THIEF_TYPES)};
    else delete state.bossHistoryMeta[key];
    usedFuture.add(id);
  }
}

function ensureBossForLevel(level){
  if(!state) return null;
  if(!state.bossHistory || typeof state.bossHistory!=='object') state.bossHistory={};
  const key=String(level);
  const hasDebugOverride=!!state.bossDebugOverrides && Object.prototype.hasOwnProperty.call(state.bossDebugOverrides,key);
  if(hasDebugOverride && state.bossDebugOverrides[key]===null){
    state.boss=null;
    return null;
  }
  const assigned = BOSS_DEFS[state.bossHistory[key]] ? state.bossHistory[key] : null;
  if(!isBossLevel(level) && !assigned){
    state.boss=null;
    return null;
  }
  let id=assigned;
  if(!id){
    id=pickBossIdForLevel(level);
    state.bossHistory[key]=id;
  }
  if(!state.bossHistoryMeta || typeof state.bossHistoryMeta!=='object') state.bossHistoryMeta={};
  if(id==='thief' && !state.bossHistoryMeta[key]?.thiefType){
    state.bossHistoryMeta[key]={thiefType:pick(BOSS_THIEF_TYPES)};
  }

  const previous=state.boss;
  const sameBoss = previous?.id===id && previous?.level===Number(level);
  state.boss={
    id,
    level:Number(level),
    targetMultiplier: BOSS_DEFS[id]?.id==='rock' ? 2 : 1,
    thiefType: id==='thief' ? ((sameBoss && previous?.thiefType) || state.bossHistoryMeta[key]?.thiefType || pick(BOSS_THIEF_TYPES)) : null,
    silencedApplied: sameBoss ? !!previous?.silencedApplied : false,
    initialized: sameBoss ? !!previous?.initialized : false,
    hiddenCount: sameBoss ? Number(previous?.hiddenCount)||0 : 0,
    assassinTargets: sameBoss && Array.isArray(previous?.assassinTargets) ? previous.assassinTargets : [],
    controlledCells: sameBoss && Array.isArray(previous?.controlledCells) ? previous.controlledCells : [],
    parasiteAdded: sameBoss ? Number(previous?.parasiteAdded)||0 : 0,
    adverseCells: sameBoss && Array.isArray(previous?.adverseCells) ? previous.adverseCells : [],
  };

  if(id==='thief' && !BOSS_THIEF_TYPES.includes(state.boss.thiefType)){
    state.boss.thiefType=state.bossHistoryMeta[key]?.thiefType || pick(BOSS_THIEF_TYPES);
  }
  if(id==='thief') state.bossHistoryMeta[key]={thiefType:state.boss.thiefType};
  return state.boss;
}

function normalizeBossState(){
  if(!state) return;
  if(!state.bossHistory || typeof state.bossHistory!=='object') state.bossHistory={};
  if(!Array.isArray(state.defeatedBosses)) state.defeatedBosses=[];
  if(!state.bossHistoryMeta || typeof state.bossHistoryMeta!=='object') state.bossHistoryMeta={};
  state.defeatedBosses=[...new Set(state.defeatedBosses.filter(id=>!!BOSS_DEFS[id]))];
  if(!isBossLevel(state.level) && !hasAssignedBossForLevel(state.level)){
    state.boss=null;
    return;
  }
  const boss=ensureBossForLevel(state.level);
  if(!boss) return;
  boss.thiefType=BOSS_THIEF_TYPES.includes(boss.thiefType) ? boss.thiefType : (boss.id==='thief' ? pick(BOSS_THIEF_TYPES) : null);
  boss.assassinTargets=Array.isArray(boss.assassinTargets) ? boss.assassinTargets : [];
  boss.controlledCells=Array.isArray(boss.controlledCells) ? boss.controlledCells : [];
  boss.adverseCells=Array.isArray(boss.adverseCells) ? boss.adverseCells : [];
}

function getBossTarget(baseTarget){
  return isCurrentBoss('rock') ? Math.round(Number(baseTarget||0)*2) : Number(baseTarget||0);
}

function getBossHandSizeModifier(){
  return isCurrentBoss('disabled') ? -1 : 0;
}

function getBossMaxBalls(defaultMax){
  return isCurrentBoss('dart') ? 1 : defaultMax;
}

function getBossMaxDiscards(defaultMax){
  return isCurrentBoss('magician') ? 0 : defaultMax;
}

function getCurrentBossTypeReduction(block){
  const boss=state?.boss;
  const def=boss?.id ? BOSS_DEFS[boss.id] : null;
  if(!def?.type || !block?.type) return 1;
  return block.type===def.type ? 0.5 : 1;
}

function cellHasAnyAdverseEffect(cell){
  return !!(cell && BOSS_ADVERSE_KEYS.some(key=>!!cell[key]));
}

function isUsableBossBoardCell(cell){
  if(!cell) return false;
  if(cell.type==='node' || cell.type==='hole' || cell.type==='black') return false;
  return true;
}

function getBlockCellForBoss(block){
  if(!block || !state?.cells) return null;
  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    if(state.cells[r][c]?.block===block) return {r,c};
  }
  return null;
}

function getNerfEffectMultiplierForBlock(block){
  const pos=getBlockCellForBoss(block);
  if(!pos) return 1;
  const cell=state.cells[pos.r]?.[pos.c];
  if(!cell?.nerf || blockIgnoresCellHazards(block)) return 1;
  return 0.5;
}

// Multipliers from independent systems stack multiplicatively: Boss type nerf,
// cell Nerf, etc. Pink Core makes a block ignore adverse-cell effects entirely.
function getBlockEffectMultiplier(block){
  if(!block) return 1;
  const bossMultiplier=getCurrentBossTypeReduction(block);
  const cellMultiplier=getNerfEffectMultiplierForBlock(block);
  return bossMultiplier*cellMultiplier;
}

function getCoreEffectMultiplier(block, coreId){
  if(!block || BOSS_NERF_CORE_UNAFFECTED.has(coreId)) return 1;
  return getBlockEffectMultiplier(block);
}

function clearBossTransientBlockFlags(){
  if(!state) return;
  const seen=new Set();
  const clear=block=>{
    if(!block || seen.has(block)) return;
    seen.add(block);
    delete block.bossSilenced;
    delete block.bossHidden;
    delete block.bossThiefSeen;
    delete block.bossThiefTarget;
  };
  (state.bag||[]).forEach(clear);
  (state.hand||[]).forEach(clear);
  (state.discardPile||[]).forEach(clear);
  if(state.cells) for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++) clear(state.cells[r][c]?.block);
}

function getBossCandidateCells({excludeKeys=new Set(), avoidAdverse=true}={}){
  const result=[];
  if(!state?.cells) return result;
  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    const key=`${r},${c}`;
    if(excludeKeys.has(key)) continue;
    const cell=state.cells[r][c];
    if(!isUsableBossBoardCell(cell)) continue;
    if(avoidAdverse && cellHasAnyAdverseEffect(cell)) continue;
    result.push({r,c});
  }
  return result;
}

function addBossAdverseCells(kind,count,options={}){
  if(!state?.cells || !['locked','debuff','nerf','controlled'].includes(kind)) return [];
  const excludeKeys=options.excludeKeys instanceof Set ? options.excludeKeys : new Set(options.excludeKeys||[]);
  const candidates=getBossCandidateCells({excludeKeys,avoidAdverse:true});
  shuffle(candidates);
  const chosen=candidates.slice(0,Math.min(Math.max(0,count),candidates.length));
  for(const {r,c} of chosen){
    const cell=state.cells[r][c];
    cell[kind]=true;
  }
  if(state.boss){
    state.boss.adverseCells=Array.isArray(state.boss.adverseCells) ? state.boss.adverseCells : [];
    for(const {r,c} of chosen){
      const item=`${r},${c},${kind}`;
      if(!state.boss.adverseCells.includes(item)) state.boss.adverseCells.push(item);
    }
  }
  return chosen.map(({r,c})=>`${r},${c}`);
}

function addRandomBossAdverseCells(count){
  const types=['locked','debuff','nerf'];
  const candidates=getBossCandidateCells({avoidAdverse:true});
  shuffle(candidates);
  const chosen=candidates.slice(0,Math.min(count,candidates.length));
  for(const {r,c} of chosen){
    const kind=pick(types);
    state.cells[r][c][kind]=true;
    if(state.boss){
      state.boss.adverseCells=Array.isArray(state.boss.adverseCells) ? state.boss.adverseCells : [];
      state.boss.adverseCells.push(`${r},${c},${kind}`);
    }
  }
  return chosen.map(({r,c})=>`${r},${c}`);
}

function parseBossCellKeys(list){
  return (Array.isArray(list)?list:[]).map(key=>{
    const [r,c]=String(key).split(',').map(Number);
    return Number.isInteger(r)&&Number.isInteger(c) ? {r,c,key:String(key)} : null;
  }).filter(Boolean);
}

function setBossAssassinTargets(count=1, options={}){
  if(!state?.boss) return [];
  const oldKeys=new Set((state.boss.assassinTargets||[]).map(String));
  for(const key of oldKeys){
    const [r,c]=String(key).split(',').map(Number);
    if(Number.isInteger(r)&&Number.isInteger(c)&&state.cells?.[r]?.[c]) state.cells[r][c].assassinTarget=false;
  }
  const excludeKeys=options.excludeKeys instanceof Set
    ? new Set(options.excludeKeys)
    : new Set((options.excludeKeys||[]).map(String));
  for(const key of oldKeys) excludeKeys.add(key);
  const candidates=getBossCandidateCells({excludeKeys,avoidAdverse:true});
  shuffle(candidates);
  const chosen=candidates.slice(0,Math.min(count,candidates.length));
  for(const {r,c} of chosen) state.cells[r][c].assassinTarget=true;
  state.boss.assassinTargets=chosen.map(({r,c})=>`${r},${c}`);
  return chosen;
}

function setBossControlledCells(count=5){
  if(!state?.boss) return [];
  const candidates=getBossCandidateCells({avoidAdverse:true});
  shuffle(candidates);
  const chosen=candidates.slice(0,Math.min(count,candidates.length));
  for(const oldKey of state.boss.controlledCells||[]){
    const [r,c]=String(oldKey).split(',').map(Number);
    if(Number.isInteger(r)&&Number.isInteger(c)&&state.cells[r]?.[c]) state.cells[r][c].controlled=false;
  }
  for(const {r,c} of chosen) state.cells[r][c].controlled=true;
  state.boss.controlledCells=chosen.map(({r,c})=>`${r},${c}`);
  return chosen;
}

function applyBossHandEffects(){
  const boss=state?.boss;
  if(!boss) return;
  const hand=(state.hand||[]).filter(Boolean);

  if(boss.id==='silencer'){
    // Only newly drawn hand blocks are eligible. The flag remains on that
    // physical block until the Boss screen ends.
    hand.forEach(block=>{ delete block.bossSilenced; });
    if(hand.length){
      const block=pick(hand);
      block.bossSilenced=true;
      boss.silencedApplied=true;
    }
  }

  if(boss.id==='illusioner'){
    // Re-roll hidden blocks on every newly drawn hand. Once a block is placed on
    // the board its hidden flag is cleared there and travels no further.
    hand.forEach(block=>{ delete block.bossHidden; });
    const candidates=[...hand];
    shuffle(candidates);
    const count=Math.min(bossRandomInt(0,3),candidates.length);
    candidates.slice(0,count).forEach(block=>{ block.bossHidden=true; });
    boss.hiddenCount=(Number(boss.hiddenCount)||0)+count;
  }

  if(boss.id==='thief'){
    if(!BOSS_THIEF_TYPES.includes(boss.thiefType)) boss.thiefType=pick(BOSS_THIEF_TYPES);
    for(const block of hand){
      block.bossThiefTarget = block.type===boss.thiefType;
    }
  }
}

function applyBossStartEffects(){
  const boss=state?.boss;
  if(!boss) return;
  const id=boss.id;

  if(id==='locker') addBossAdverseCells('locked',bossRandomInt(2,5));
  if(id==='debuffer') addBossAdverseCells('debuff',bossRandomInt(2,5));
  if(id==='nerfer') addBossAdverseCells('nerf',bossRandomInt(2,5));
  if(id==='parasite'){
    const count=bossRandomInt(1,3);
    boss.parasiteAdded=addRandomBossAdverseCells(count).length;
  }

  if(id==='thief' && !BOSS_THIEF_TYPES.includes(boss.thiefType)) boss.thiefType=pick(BOSS_THIEF_TYPES);

  if(id==='assassin') setBossAssassinTargets(bossRandomInt(1,2));

  if(id==='hacker') setBossControlledCells(5);

  boss.initialized=true;
}

function isBossAssassinTarget(r,c){
  return !!state?.boss?.assassinTargets?.includes(`${r},${c}`);
}

function isBossControlledCell(r,c){
  return !!state?.boss?.controlledCells?.includes(`${r},${c}`);
}

function shouldBlockBeAffectedByBossHazard(block){
  return !blockIgnoresCellHazards(block);
}

function triggerBossThiefOnBlockPass(block,options={}){
  if(!state?.boss || state.boss.id!=='thief' || options.replay || !block) return false;
  // The selected Thief type is persisted once per screen, while the target/seen
  // flags live directly on each physical block so the effect travels with it.
  if(block.bossThiefTarget!==true || block.bossThiefSeen) return false;
  block.bossThiefSeen=true;
  state.money=Math.max(0,Number(state.money||0)-1);
  syncMoneyHud();
  return true;
}

function removeBlockAtBossTarget(r,c){
  const block=state.cells?.[r]?.[c]?.block;
  if(!block) return false;
  if(blockHasCore(block,'blue')) return false;
  return breakBlockAt(r,c);
}

function getBossTargetCellsForAnimation(){
  return parseBossCellKeys(state?.boss?.assassinTargets);
}

async function prepareControlledCellsBeforeShot(){
  if(!state?.cells) return false;
  const positions=[];
  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    if(state.cells[r][c]?.controlled) positions.push({r,c});
  }
  if(!positions.length) return false;

  let rotated=false;
  for(const pos of positions){
    const cell=state.cells?.[pos.r]?.[pos.c];
    const block=cell?.block;
    if(!block || blockIgnoresCellHazards(block)) continue;
    const cellEl=boardEl.querySelector(`.cell[data-r="${pos.r}"][data-c="${pos.c}"]`);

    // Rotate the physical block first. The controlled-cell icon is then used
    // as the visual feedback for that exact rotation.
    block.rotation=Math.floor(Math.random()*4);
    rotated=true;
    const visual=cellEl?.querySelector('.block-visual');
    if(visual){
      const deg=block.rotation*90;
      visual.dataset.deg=deg;
      visual.style.setProperty('--block-base-rotation', `${deg}deg`);
      visual.style.transform=`rotate(${deg}deg)`;
    }

    if(cellEl){
      // Animate the same visible controlled-cell icon rather than layering a
      // second icon over it. The animation is: 50% -> 100%, one full 360° turn,
      // then back to 50%.
      const icon=cellEl.querySelector('.boss-controlled-icon') || (()=>{
        const created=document.createElement('div');
        created.className='boss-controlled-icon';
        created.textContent='↻';
        created.style.color=BOSS_CONTROLLED_COLOR;
        cellEl.appendChild(created);
        return created;
      })();
      icon.classList.remove('boss-controlled-icon-trigger');
      void icon.offsetWidth;
      icon.classList.add('boss-controlled-icon-trigger');
      setTimeout(()=>icon.classList.remove('boss-controlled-icon-trigger'),scaledDuration(720));
    }
  }

  if(rotated) await wait(680);
  return rotated;
}

function resolveBossTargetCellsAfterShot(){
  if(!state?.cells) return [];
  const removed=[];
  for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
    const cell=state.cells[r][c];
    if(!cell?.assassinTarget || !cell.block) continue;
    if(removeBlockAtBossTarget(r,c)){
      cell.assassinTarget=false;
      removed.push(`${r},${c}`);
      if(state.boss?.assassinTargets) state.boss.assassinTargets=state.boss.assassinTargets.filter(key=>key!==`${r},${c}`);
    }
  }
  return removed;
}

async function applyBossAfterShot(){
  const boss=state?.boss || null;

  // Target cells are adverse cells in their own right and are independent of
  // the currently active Boss. Whenever a shot resolves, any occupied target
  // cell annihilates its block, then the target mark disappears.
  const previousAssassinTargets = boss?.id==='assassin'
    ? new Set((boss.assassinTargets||[]).map(String))
    : null;
  resolveBossTargetCellsAfterShot();

  if(boss?.id==='assassin'){
    setBossAssassinTargets(bossRandomInt(1,2), {excludeKeys:previousAssassinTargets});
  }

  if(boss?.id==='hacker'){
    setBossControlledCells(5);
  }

  if(boss?.id==='parasite'){
    addRandomBossAdverseCells(bossRandomInt(1,3));
  }

  render();
}
