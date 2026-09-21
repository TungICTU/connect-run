// ---------- run statistics ----------
// Statistics are part of the current run save. They are recreated by newRun()
// and normalized when an older save does not contain them.
const STAT_BLOCK_TYPES = ['straight','L','T','plus'];

function createRunStats(){
  const blocks = {};
  for(const type of STAT_BLOCK_TYPES){
    blocks[type] = { placed:0, passed:0, lost:0 };
  }

  const buffs = {};
  for(const def of BUFF_POOL){ buffs[def.id] = 0; }

  const upgrades = {};
  for(const def of UPGRADE_POOL){ upgrades[def.id] = 0; }

  const powers = {};
  for(const id of Object.keys(POWER_CARD_DEFS)){ powers[id] = 0; }

  return { version:1, blocks, buffs, upgrades, powers };
}

function ensureRunStats(){
  if(!state) return null;
  const fresh = createRunStats();
  const old = state.stats && typeof state.stats === 'object' ? state.stats : {};
  state.stats = {
    version:1,
    blocks:{},
    buffs:{...fresh.buffs, ...(old.buffs||{})},
    upgrades:{...fresh.upgrades, ...(old.upgrades||{})},
    powers:{...fresh.powers, ...(old.powers||{})},
  };

  for(const type of STAT_BLOCK_TYPES){
    const src = old.blocks?.[type] || {};
    state.stats.blocks[type] = {
      placed:Math.max(0, Math.floor(Number(src.placed)||0)),
      passed:Math.max(0, Math.floor(Number(src.passed)||0)),
      lost:Math.max(0, Math.floor(Number(src.lost)||0)),
    };
  }
  return state.stats;
}

function getBlockStat(type){
  const stats=ensureRunStats();
  return stats?.blocks?.[type] || {placed:0,passed:0,lost:0};
}

function recordBlockPlaced(block){
  if(!block?.type) return;
  const stats=ensureRunStats();
  if(stats?.blocks?.[block.type]) stats.blocks[block.type].placed++;
}

function recordBlockPassed(block){
  if(!block?.type) return;
  const stats=ensureRunStats();
  if(stats?.blocks?.[block.type]) stats.blocks[block.type].passed++;
}

function recordBlockLost(block){
  if(!block?.type) return;
  const stats=ensureRunStats();
  if(stats?.blocks?.[block.type]) stats.blocks[block.type].lost++;
}

function recordBuffPurchase(id){
  const stats=ensureRunStats();
  if(!stats?.buffs || !(id in stats.buffs)) return;
  stats.buffs[id]++;
}

function recordUpgradeUse(id){
  const stats=ensureRunStats();
  if(!stats?.upgrades || !(id in stats.upgrades)) return;
  stats.upgrades[id]++;
}

function recordPowerUse(id){
  const stats=ensureRunStats();
  if(!stats?.powers || !(id in stats.powers)) return;
  stats.powers[id]++;
}

function getBlockStatLevel(type){
  return 1 + ((state?.typeBonus?.[type]||0) / 5);
}
