// ---------- run / level state ----------
let state = null;
// Invalidates async shots from previous runs so they cannot mutate a new run.
let runGeneration = 0;
let rewardGeneration = 0;
let _ballUid = 1;
function ballUid(){ return 'b' + (_ballUid++); }
function ensureBallIds(){ state.ballPool.forEach(b=>{ if(!b._id) b._id=ballUid(); }); }


// ---------- persistent save / load ----------
// Saves the current run locally in the browser. No account or server is required.
const SAVE_KEY = 'connect-run-save-v1';
const SAVE_VERSION = 5;
let saveTimer = null;
let savePending = false;



function snapshotGameState(){
  if(!state) return null;

  // Only copy gameplay data. Runtime/UI-only state such as targeting, drag data,
  // functions, animation helpers and Sets are converted/omitted intentionally.
  const save = JSON.parse(JSON.stringify(state, (key, value)=>{
    if(typeof value === 'function') return undefined;
    if(key === '_animateNewHoleConnections') return undefined;
    if(key === '_splitUsed') return undefined;
    if(key === '_boardHideComplete') return undefined;
    if(key === '_boardReveal') return undefined;
    if(key === '_boardHide') return undefined;
    if(key === 'resolving') return false;
    if(key === 'targeting') return null;
    if(key === 'lastUpgrade') return undefined;
    if(key === 'shopBuff') return undefined;
    if(key === 'holeConnections') return [...state.holeConnections];
    if(key === '_bossRuntime') return undefined;
    return value;
  }));

  save.version = SAVE_VERSION;
  save.lastUpgradeId = state.lastUpgrade?.id || null;
  save.shopBuffId = state.shopBuff?.id || null;
  save.shopBuffBought = !!state.shopBuffBought;
  // targeting is intentionally not restored after a reload.
  save.targeting = null;
  return save;
}

function saveGame(options={}){
  if(!state || state.resolving) return false;
  try{
    const save = snapshotGameState();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    savePending = false;
    return true;
  }catch(err){
    console.error('Không thể lưu game:', err);
    return false;
  }
}

function syncSaveCounters(){
  let maxBall = 0;
  const ballIds = [];
  (state?.ballPool || []).forEach(b=>{ if(b?._id) ballIds.push(b._id); });
  (state?.ballQueue || []).forEach(b=>{ if(b?._id) ballIds.push(b._id); });
  ballIds.forEach(id=>{ const n=Number(String(id).replace(/^b/,'')); if(Number.isFinite(n)) maxBall=Math.max(maxBall,n); });
  _ballUid = Math.max(_ballUid, maxBall+1);

  let maxCard = 0;
  const cardIds = [];
  (state?.cardHand || []).forEach(c=>{ if(c?.id) cardIds.push(c.id); });
  (state?.gachaStock || []).forEach(g=>{ if(g?.id) cardIds.push(g.id); });
  cardIds.forEach(id=>{ const n=Number(String(id).replace(/^c/,'')); if(Number.isFinite(n)) maxCard=Math.max(maxCard,n); });
  _uid = Math.max(_uid, maxCard+1);
}

function restoreKnownObjects(){
  if(!state) return;

  state.holeConnections = new Set(state.holeConnections || []);
  state.targeting = null;
  state.resolving = false;
  ensureRunStats();
  normalizeBossState();
  state.defeatedBosses = Array.isArray(state.defeatedBosses) ? [...new Set(state.defeatedBosses)] : [];
  state.bossDebugOverrides = (state.bossDebugOverrides && typeof state.bossDebugOverrides==='object') ? state.bossDebugOverrides : {};
  state.bossHistoryMeta = (state.bossHistoryMeta && typeof state.bossHistoryMeta==='object') ? state.bossHistoryMeta : {};

  state.lastUpgrade = state.lastUpgradeId
    ? (UPGRADE_POOL.find(x=>x.id===state.lastUpgradeId) || null)
    : null;
  delete state.lastUpgradeId;

  if(state.shopBuffId){
    const def = BUFF_POOL.find(x=>x.id===state.shopBuffId);
    if(def){
      state.shopBuff = {...def, bought: !!state.shopBuffBought};
    } else {
      state.shopBuff = null;
    }
  } else {
    state.shopBuff = null;
  }
  delete state.shopBuffId;

  // Older/newer saves may omit fields; keep them compatible with this build.
  state.typeBonus = {...{straight:0,L:0,T:0,plus:0}, ...(state.typeBonus||{})};
  state.pendingBlocks = state.pendingBlocks || [];
  state.ballPool = state.ballPool || [];
  state.ballQueue = state.ballQueue || [];
  state.cardHand = state.cardHand || [];
  state.lastUsedCard = state.lastUsedCard || null;
  state.discardBonus = Number.isFinite(state.discardBonus) ? state.discardBonus : 0;
  state.handSizeBonus = Number.isFinite(state.handSizeBonus) ? state.handSizeBonus : 0;
  state.discountBonus = !!state.discountBonus;
  state.ownedBuffIds = Array.isArray(state.ownedBuffIds) ? state.ownedBuffIds : [];
  state.bag = state.bag || [];
  state.hand = state.hand || [];
  state.discardPile = state.discardPile || [];
  state.pendingBlocks = (state.pendingBlocks || []).map(b=>({...b, core:normalizeCore(b.core)}));
  state.bag = state.bag.map(b=>({...b, core:normalizeCore(b.core)}));
  state.hand = state.hand.map(b=>b ? {...b, core:normalizeCore(b.core)} : b);
  state.discardPile = state.discardPile.map(b=>({...b, core:normalizeCore(b.core)}));
  if(Array.isArray(state.cells)){
    for(let r=0;r<state.cells.length;r++) for(let c=0;c<(state.cells[r]?.length||0);c++) if(state.cells[r][c]?.block) state.cells[r][c].block.core=normalizeCore(state.cells[r][c].block.core);
  }
  state.discardsLeft = Number.isFinite(state.discardsLeft) ? state.discardsLeft : 3;
  state.commonRerollCost = Number.isFinite(state.commonRerollCost) ? state.commonRerollCost : 3;

  // Persist the location-bar rail position so reloads reconstruct the same
  // visible history instead of starting again from current - 2.
  state.locationBarFirstLevel = Math.max(1, Math.floor(Number(state.locationBarFirstLevel) || Math.max(1, Number(state.level || 1) - 2)));

  ensureBallIds();
  syncSaveCounters();
}

function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const save = JSON.parse(raw);
    if(!save || typeof save !== 'object') return false;
    if(save.version && save.version > SAVE_VERSION) return false;

    state = save;
    restoreKnownObjects();

    if(state.phase === 'playing'){
      render();
      renderLocationBar?.(false);
      renderTargetBanner();
      hideOverlay();
      hideShop();
      return true;
    }

    if(state.phase === 'shop'){
      render();
      renderLocationBar?.(false);
      hideOverlay();
      renderCardHand();
      openShop();
      return true;
    }

    if(state.phase === 'reward'){
      hideOverlay();
      hideShop();
      const unfired = Math.max(0, state.ballQueue.length - state.ballsFired);
      const interestCap = 5 + state.interestCapBonus;
      const interest = Math.min(Math.floor(state.money/5), interestCap);
      state._boardHide = false;
      render();
      renderLocationBar?.(false);
      runBoardHideAnimation(()=>showLevelReward({winBonus:getWinBonus(), unfired, ballBonus:unfired*2, interest}));
      return true;
    }

    // gameover (or unknown terminal state): reconstruct the standard lose overlay.
    render();
    renderLocationBar?.(false);
    renderCardHand();
    hideShop();
    showOverlay('lose', 'GAME OVER', `Dừng lại ở màn ${formatNumber(state.level)}, đạt ${formatNumber(state.score)}/${formatNumber(state.target)} điểm. Tổng tiền tích luỹ: ${formatMoney(state.money)}.`);
    return true;
  }catch(err){
    console.error('Không thể tải save:', err);
    return false;
  }
}

function deleteSave(){
  try{ localStorage.removeItem(SAVE_KEY); }catch(err){ console.error('Không thể xoá save:', err); }
}

function scheduleAutoSave(){
  if(!state || state.resolving) return;
  savePending = true;
  if(saveTimer) return;
  saveTimer = setTimeout(()=>{
    saveTimer = null;
    if(savePending) saveGame({silent:false});
  }, 700);
}

function flushAutoSave(){
  if(state && !state.resolving) saveGame({silent:true});
}

function newRun(){
  rewardGeneration++;
  // Invalidate async work from the previous run before replacing the global state.
  runGeneration++;
  if(boardRevealTimer){
    clearTimeout(boardRevealTimer);
    boardRevealTimer=null;
  }
  document.querySelectorAll('.ball, .ball-tooltip, .ball-goal-popup, .block-exit-tooltip').forEach(el=>el.remove());
  ballClickSelection=null;
  suppressBallClickUntil=0;

  state = {
    money: 3, level: 0,
    locationBarFirstLevel: 1,
    baseRateBonus: 0, typeBonus: { straight:0, L:0, T:0, plus:0 },
    maxBallsBonus: 0, bagBonus: 0, startBonus: 0, interestCapBonus: 0,
    discardBonus: 0, handSizeBonus: 0, discountBonus: false, ownedBuffIds: [],
    pendingBlocks: [], nextBallPreset: null,
    ballPool: Array.from({length:BASE_MAX_BALLS}, ()=>({_id:ballUid(), property:null, enhancement:null})),
    cardHand: [], lastUpgrade: null, lastUsedCard: null, targeting: null,
    phase: 'playing',
    shopBuff: null, shopBuffBought: false, commonItems: null, commonRerollCost: 3,
    bag: [], hand: [], discardPile: [], discardsLeft: 3, cells: null, holeConnections: new Set(),
    stats: createRunStats(),
    boss: null,
    bossHistory: {},
    bossHistoryMeta: {},
    defeatedBosses: [],
    bossDebugOverrides: {}
  };
  state.bag = makeInitialDeck();
  ensureBallIds();
  newLevel();
  scheduleAutoSave();
}

function computeTarget(level){
  const EARLY_TARGETS = [
    300, 600, 900, 1500, 2400, 3300, 4500, 6000, 7500,
    12000, 16500, 21000, 33000, 45000, 60000, 76000, 87000, 100000
  ];
  if(level <= EARLY_TARGETS.length) return EARLY_TARGETS[Math.max(0, level - 1)];
  const n = level - 18;
  const target =
    100000 *
    Math.pow(2.25, n) *
    Math.pow(1.1, (n * (n - 1)) / 2);
  return Math.round(target);
}

// kho đồ (bag) is generated once per run and persists (recycled level to level) until loss/restart
function makeInitialDeck(){
  let bag = [];
  for(const type in BAG_RECIPE){
    for(let i=0;i<BAG_RECIPE[type];i++) bag.push({ type, rotation:0, property:null, enhancement:null, core:null });
  }
  shuffle(bag);
  return bag;
}

function makeBallQueue(){
  // The boss Dart limits only the balls available for this level; it must not
  // permanently delete balls from the player's persistent ball pool.
  const persistentMax = BASE_MAX_BALLS + state.maxBallsBonus;
  while(state.ballPool.length < persistentMax) state.ballPool.push({_id:ballUid(),property:null, enhancement:null});
  if(state.ballPool.length > persistentMax) state.ballPool.length = persistentMax;
  ensureBallIds();
  const queueMax = Math.max(0, Math.min(persistentMax, getBossMaxBalls(persistentMax)));
  const queue = state.ballPool.slice(0, queueMax).map(b => ({_id:b._id, fired:false, property:b.property||null, enhancement:b.enhancement||null}));
  if(state.nextBallPreset){
    queue[0].property = state.nextBallPreset.property;
    queue[0].enhancement = state.nextBallPreset.enhancement;
    state.nextBallPreset = null;
  }
  return queue;
}

function getBlackBlockCount(level){
  if(level < 4) return 0;

  // Exact obstacle-count distribution requested by stage.
  const roll = Math.random();

  if(level === 4) return roll < 0.40 ? 1 : 0;
  if(level === 5) return roll < 0.60 ? 1 : 0;
  if(level === 6) return roll < 0.80 ? 1 : 0;

  if(level >= 7 && level <= 9){
    return roll < 0.20 ? 2 : 1;
  }

  if(level >= 10 && level <= 12){
    const twoChance = (level - 10) * 0.20 + 0.40; // 40/60/80%
    return roll < twoChance ? 2 : 1;
  }

  if(level === 13){
    if(roll < 0.20) return 3;
    if(roll < 0.80) return 2;
    return 1;
  }

  if(level >= 14 && level <= 16){
    const threeChance = (level - 14) * 0.20 + 0.40; // 40/60/80%
    return roll < threeChance ? 3 : 2;
  }

  if(level === 17){
    if(roll < 0.20) return 4;
    if(roll < 0.80) return 3;
    return 2;
  }

  // Level 18+: always 3, with a 20% chance to spawn 4.
  return roll < 0.20 ? 4 : 3;
}

function placeBlackBlocks(cells, rows, cols, nodeR, nodeC, nodeDir, holeR, holeC, level){
  const count = getBlackBlockCount(level);
  if(!count) return [];

  // Never place a black block directly in the node's initial firing lane.
  // The shot starts from the node and travels in state.node.dir until it
  // meets a redirecting block/hole or leaves the board. Blocking that
  // straight line would make the stage spawn with an unfair forced loss.
  const blockedRay = new Set();
  if(Number.isInteger(nodeDir)){
    const [dx,dy]=DIR_VEC[nodeDir];
    let r=nodeR+dy, c=nodeC+dx;
    while(r>=0 && r<rows && c>=0 && c<cols){
      blockedRay.add(`${r},${c}`);
      if(cells[r][c].type==='hole' || cells[r][c].type==='node') break;
      const occupied = cells[r][c].block;
      if(occupied) break;
      r+=dy; c+=dx;
    }
  }

  const candidates=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if((r===nodeR && c===nodeC) || (r===holeR && c===holeC)) continue;
    if(cells[r][c].type!=='empty') continue;
    if(blockedRay.has(`${r},${c}`)) continue;
    candidates.push([r,c]);
  }
  shuffle(candidates);
  const placed=candidates.slice(0, Math.min(count, candidates.length));
  for(const [r,c] of placed) cells[r][c]={type:'black',block:null};
  return placed;
}

