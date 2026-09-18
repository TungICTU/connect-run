// ---------- block core system ----------
// A block may optionally carry one core in addition to its property/enhancement.
// Counted cores store their persistent starting count on the block. Runtime use
// counts are kept separately in shotMeta so every new shot resets them.
const CORE_IDS = ['red','orange','yellow','green','blue','purple','pink'];

const CORE_LABEL = {
  red: 'Lõi đỏ',
  orange: 'Lõi cam',
  yellow: 'Lõi vàng',
  green: 'Lõi xanh lá',
  blue: 'Lõi xanh dương',
  purple: 'Lõi tím',
  pink: 'Lõi hồng',
};

const CORE_COLOR = {
  red: '#e74c3c',
  orange: '#f2994a',
  yellow: '#f2c94c',
  green: '#27ae60',
  blue: '#2f80ed',
  purple: '#9b51e0',
  pink: '#eb6ba8',
};

const CORE_DEFS = {
  red: {
    id: 'red',
    label: CORE_LABEL.red,
    color: CORE_COLOR.red,
    desc: 'Lặp lại chức năng của khối 1 lần.',
    tooltip: null,
    hasCount: false,
    initialCount: null,
  },
  orange: {
    id: 'orange',
    label: CORE_LABEL.orange,
    color: CORE_COLOR.orange,
    desc: 'x1.5 điểm bóng chứa khi bóng thoát khối.',
    tooltip: 'x1.5',
    hasCount: true,
    initialCount: 1,
  },
  yellow: {
    id: 'yellow',
    label: CORE_LABEL.yellow,
    color: CORE_COLOR.yellow,
    desc: '+3$ khi bóng thoát khối.',
    tooltip: '+3$',
    hasCount: true,
    initialCount: 1,
  },
  green: {
    id: 'green',
    label: CORE_LABEL.green,
    color: CORE_COLOR.green,
    desc: '25% x2 điểm bóng chứa khi bóng thoát khối; 5% nhận 20$ khi bóng thoát khối.',
    tooltip: null,
    hasCount: false,
    initialCount: null,
  },
  blue: {
    id: 'blue',
    label: CORE_LABEL.blue,
    color: CORE_COLOR.blue,
    desc: 'Khối của lõi này không bao giờ bị phá hủy bởi bất kỳ cơ chế nào.',
    tooltip: null,
    hasCount: false,
    initialCount: null,
  },
  purple: {
    id: 'purple',
    label: CORE_LABEL.purple,
    color: CORE_COLOR.purple,
    desc: 'Cho phép khối sinh thêm bóng một lần split nữa.',
    tooltip: 'Split +1',
    hasCount: true,
    initialCount: 1,
  },
  pink: {
    id: 'pink',
    label: CORE_LABEL.pink,
    color: CORE_COLOR.pink,
    desc: 'Vô hiệu hóa mọi hiệu ứng bất lợi của ô mà khối đang ở.',
    tooltip: null,
    hasCount: false,
    initialCount: null,
  },
};

function coreHasCount(core){
  return !!(core && CORE_DEFS[core.id]?.hasCount);
}

function normalizeCore(core){
  if(!core || typeof core !== 'object' || !CORE_DEFS[core.id]) return null;
  const def = CORE_DEFS[core.id];
  const normalized = { id: def.id };
  if(def.hasCount){
    const count = Number(core.count);
    normalized.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : def.initialCount;
  }
  return normalized;
}

function makeCore(id, countOverride=null){
  const def = CORE_DEFS[id];
  if(!def) return null;
  const core = { id: def.id };
  if(def.hasCount){
    const count = Number(countOverride);
    core.count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : def.initialCount;
  }
  return core;
}

function cloneCore(core){
  const normalized = normalizeCore(core);
  return normalized ? {...normalized} : null;
}

function randomCore(){
  return makeCore(CORE_IDS[Math.floor(Math.random() * CORE_IDS.length)]);
}

// Runtime count is tracked per logical block for the current shot.
// This intentionally does not mutate block.core.count.
function getCoreUses(block, shotMeta){
  if(!block || !coreHasCount(block.core) || !shotMeta) return 0;
  if(!shotMeta.coreUses) shotMeta.coreUses = new Map();
  const stored = shotMeta.coreUses.get(block);
  if(Number.isFinite(stored)) return stored;
  const initial = Math.max(1, Math.floor(Number(block.core.count) || CORE_DEFS[block.core.id].initialCount || 1));
  shotMeta.coreUses.set(block, initial);
  return initial;
}

function getCoreDisplayCount(block){
  if(!block?.core || !coreHasCount(block.core)) return null;
  const shotMeta = state?._activeShotMeta;
  if(shotMeta){
    return getCoreUses(block, shotMeta);
  }
  return Math.max(1, Math.floor(Number(block.core.count) || CORE_DEFS[block.core.id].initialCount || 1));
}

function refreshCoreCountVisual(block, count){
  if(!block) return;
  document.querySelectorAll('.block-core-dot').forEach(dot=>{
    if(dot._coreBlock !== block) return;
    dot.textContent = String(count);
  });
}

// Build the tooltip for a red-core replay from the exact tooltip produced by
// the repeated property/enhancement effect. The text is intentionally kept
// identical; only the visual accent changes to the red-core color.
function makeRedCoreReplayTooltip(item){
  if(!item?.text) return null;
  return {
    ...item,
    kind:`core-red-${item.kind || 'effect'}`,
    color:CORE_COLOR.red,
    coreReplay:true,
  };
}

function coreCanUse(block, shotMeta){
  if(!block?.core || !CORE_DEFS[block.core.id]) return false;
  if(!coreHasCount(block.core)) return true;
  return getCoreUses(block, shotMeta) > 0;
}

// Red core is a one-time replay per block during a single shot.
// This is separate from counted-core uses because the red core itself has no count.
function redCoreCanReplay(block, shotMeta){
  if(!blockHasCore(block, 'red') || !shotMeta) return false;
  if(!shotMeta.redCoreReplayedBlocks) shotMeta.redCoreReplayedBlocks = new Set();
  return !shotMeta.redCoreReplayedBlocks.has(block);
}

function markRedCoreReplayed(block, shotMeta){
  if(!blockHasCore(block, 'red') || !shotMeta) return;
  if(!shotMeta.redCoreReplayedBlocks) shotMeta.redCoreReplayedBlocks = new Set();
  shotMeta.redCoreReplayedBlocks.add(block);
}

function consumeCoreUse(block, shotMeta){
  if(!block?.core || !CORE_DEFS[block.core.id] || !shotMeta) return false;
  if(!coreHasCount(block.core)) return true;
  const current = getCoreUses(block, shotMeta);
  if(current <= 0) return false;
  const next = current - 1;
  shotMeta.coreUses.set(block, next);
  refreshCoreCountVisual(block, next);
  return true;
}

function blockHasCore(block, id){
  return !!(block?.core && block.core.id === id && CORE_DEFS[id]);
}

// Central policy hook for cell hazards. New adverse-cell mechanics should call
// this helper instead of checking individual hazard types directly.
function blockIgnoresCellHazards(block){
  return blockHasCore(block, 'pink');
}
