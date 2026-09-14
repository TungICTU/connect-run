// ---------- adverse cells (locks + debuffs) ----------
// Progression: 7-9 = 1 lock; 10 = 1 lock + 1 debuff;
// 11-12 = 2 random adverse cells; 13-15 = 3; 16-18 = 4;
// 19+ = 5, then 6/7/8/9 are rolled in sequence. Each new slot starts
// at 20% and increases by 20% per level until guaranteed.
function getAdverseCellPlan(level){
  if(level < 7) return [];
  if(level <= 9) return ['lock'];
  if(level === 10) return ['lock','debuff'];
  if(level <= 12) return [null,null];
  if(level <= 15) return [null,null,null];
  if(level <= 18) return [null,null,null,null];

  const plan=[null,null,null,null,null];
  // Slot 6: 20% at level 19, then +20%/level, guaranteed at level 23.
  for(let slot=6; slot<=18; slot++){
    const startLevel=19 + (slot-6)*5;
    if(level < startLevel) break;
    const chance=Math.min(1, 0.20*(level-startLevel+1));
    if(Math.random() < chance || chance >= 1){
      plan.push(null);
    } else {
      break;
    }
  }
  return plan;
}

function placeAdverseCells(cells, rows, cols, nodeR, nodeC, holeR, holeC, level){
  const plan=getAdverseCellPlan(level);
  if(!plan.length) return [];

  const candidates=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if((r===nodeR && c===nodeC) || (r===holeR && c===holeC)) continue;
    if(cells[r][c].type!=='empty' || cells[r][c].block) continue;
    candidates.push([r,c]);
  }
  shuffle(candidates);
  const placed=candidates.slice(0,Math.min(plan.length,candidates.length));

  for(let i=0;i<placed.length;i++){
    const [r,c]=placed[i];
    const kind=plan[i] || (Math.random()<0.5 ? 'lock' : 'debuff');
    if(kind==='lock') cells[r][c].locked=true;
    else cells[r][c].debuff=true;
  }
  return placed;
}

function newLevel(){
  rewardGeneration++;
  const rewardBtn = document.getElementById('overlayBtn');
  if(rewardBtn){
    rewardBtn.dataset.busy='';
    rewardBtn.disabled=false;
    rewardBtn.onclick=newRun;
  }
  state.level += 1;
  state.target = computeTarget(state.level);
  state.score = 0;
  state.ballsFired = 0;
  state.resolving = false;
  state.phase = 'playing';
  state.targeting = null;
  state.discardsLeft = getMaxDiscards();
  if(state.level===1 || (state.level>1 && (state.level-1)%3===0)){ state.shopBuff = {...pickAvailableBuff(), bought:false}; state.shopBuffBought=false; }

  // recycle everything from the previous level (board + hand + discards) back into the persistent bag
  if(state.cells){
    for(let r=0;r<state.rows;r++) for(let c=0;c<state.cols;c++){
      const b = state.cells[r][c].block;
      if(b) state.bag.push(b);
    }
  }
  state.bag.push(...state.hand.filter(Boolean));
  state.bag.push(...state.discardPile);
  state.hand = [];
  state.discardPile = [];
  if(state.pendingBlocks.length){ state.bag.push(...state.pendingBlocks); state.pendingBlocks = []; }
  state.bag.forEach(block=>{ if(block) block.rotation=0; });
  shuffle(state.bag);

  const boardOptions = state.level===1
    ? [[4,4]]
    : state.level<=6
      ? [[4,4],[4,5],[5,4],[5,5]]
      : state.level<=12
        ? [[4,4],[4,5],[5,4],[4,6],[6,4],[5,5],[5,6],[6,5],[6,6]]
        : [[5,5],[5,6],[6,5],[5,7],[7,5],[6,6],[6,7],[7,6],[7,7]];
  let [rows,cols] = pick(boardOptions);
  const cells = [];
  for(let r=0;r<rows;r++){ const row=[]; for(let c=0;c<cols;c++) row.push({type:'empty', block:null}); cells.push(row); }

  let nodeR, nodeC, validDirs;
  do{
    nodeR = Math.floor(Math.random()*rows);
    nodeC = Math.floor(Math.random()*cols);
    validDirs = [0,1,2,3].filter(d=>{ const [dx,dy]=DIR_VEC[d]; const nr=nodeR+dy, nc=nodeC+dx; return nr>=0&&nr<rows&&nc>=0&&nc<cols; });
  } while(validDirs.length===0);
  const nodeDir = validDirs[Math.floor(Math.random()*validDirs.length)];
  cells[nodeR][nodeC] = {type:'node', block:null};

  let holeR, holeC;
  const holeCandidates = [];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if(Math.abs(r-nodeR)<=1 && Math.abs(c-nodeC)<=1) continue;
    holeCandidates.push([r,c]);
  }
  if(!holeCandidates.length){
    state.level -= 1;
    return newLevel();
  }
  [holeR,holeC] = pick(holeCandidates);
  cells[holeR][holeC] = {type:'hole', block:null};

  placeBlackBlocks(cells, rows, cols, nodeR, nodeC, nodeDir, holeR, holeC, state.level);
  placeAdverseCells(cells, rows, cols, nodeR, nodeC, holeR, holeC, state.level);

  state.rows = rows; state.cols = cols; state.cells = cells;
  state.node = {r:nodeR, c:nodeC, dir:nodeDir};
  state.hole = {r:holeR, c:holeC};
  state.holeConnections.clear();

  state.hand = [];
  refillHand();
  state.ballQueue = makeBallQueue();

  state._boardReveal = true;
  state._handReveal = true;
  state._handHide = false;
  state._handRewardHidden = false;
  render();
  hideOverlay();
  hideShop();
  renderTargetBanner();
}

function refillHand(animate=false){
  if(state.hand.some(Boolean)) return;
  state.hand = [];
  while(state.hand.length < getMaxHandSize() && state.bag.length > 0) state.hand.push(state.bag.shift());
  if(animate && typeof refreshAnimSlots !== 'undefined') refreshAnimSlots = new Set(state.hand.map((_,i)=>i));
}

function discardHand(){
  if(state.discardsLeft<=0 || !state.hand.some(Boolean) || state.resolving || state.phase!=='playing' || state.targeting) return;
  state.discardsLeft--;
  state.discardPile.push(...state.hand.filter(Boolean));
  state.hand = [];
  refillHand();
  refreshAnimSlots = new Set(state.hand.map((_,i)=>i));
  render();
  scheduleAutoSave();
}

