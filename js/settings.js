// ---------- settings / run statistics UI ----------
const settingsOverlayEl = document.getElementById('settingsOverlay');
const settingsBtnEl = document.getElementById('settingsBtn');
const settingsCloseBtnEl = document.getElementById('settingsCloseBtn');
const restartGameBtnEl = document.getElementById('restartGameBtn');
const settingsGameTabEl = document.getElementById('settingsGameTab');
const settingsStatsTabEl = document.getElementById('settingsStatsTab');
const settingsGamePanelEl = document.getElementById('settingsGamePanel');
const settingsStatsPanelEl = document.getElementById('settingsStatsPanel');
const statsBlocksTabEl = document.getElementById('statsBlocksTab');
const statsUpgradesTabEl = document.getElementById('statsUpgradesTab');
const statsBuffsTabEl = document.getElementById('statsBuffsTab');
const statsBlocksPanelEl = document.getElementById('statsBlocksPanel');
const statsUpgradesPanelEl = document.getElementById('statsUpgradesPanel');
const statsBuffsPanelEl = document.getElementById('statsBuffsPanel');
const gameSpeedRangeEl = document.getElementById('gameSpeedRange');
const gameSpeedValueEl = document.getElementById('gameSpeedValue');

function formatSpeed(value){ return `${normalizeAnimationSpeed(value).toFixed(2)}x`; }

function refreshSpeedControl(){
  if(!gameSpeedRangeEl || !gameSpeedValueEl) return;
  gameSpeedRangeEl.min=String(GAME_SPEED_MIN);
  gameSpeedRangeEl.max=String(GAME_SPEED_MAX);
  gameSpeedRangeEl.step=String(GAME_SPEED_STEP);
  gameSpeedRangeEl.value=String(animationSpeed);
  gameSpeedValueEl.textContent=formatSpeed(animationSpeed);
  const pct=((animationSpeed-GAME_SPEED_MIN)/(GAME_SPEED_MAX-GAME_SPEED_MIN))*100;
  gameSpeedValueEl.style.left=`${Math.max(0,Math.min(100,pct))}%`;
}

function setSettingsSpeed(value){
  setAnimationSpeed(value, true);
  refreshSpeedControl();
}

function startCustomSpeedInput(){
  if(!gameSpeedValueEl || gameSpeedValueEl.querySelector('input')) return;
  const input=document.createElement('input');
  input.type='number';
  input.min=String(GAME_SPEED_MIN);
  input.max=String(GAME_SPEED_MAX);
  input.step=String(GAME_SPEED_STEP);
  input.value=animationSpeed.toFixed(2);
  input.setAttribute('aria-label','Nhập tốc độ game');
  input.className='speed-value-input';
  gameSpeedValueEl.textContent='';
  gameSpeedValueEl.appendChild(input);
  input.focus();
  input.select();

  let done=false;
  const finish=(commit)=>{
    if(done) return;
    done=true;
    if(commit) setSettingsSpeed(input.value);
    else refreshSpeedControl();
  };
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); finish(true); }
    else if(e.key==='Escape'){ e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur',()=>finish(true), {once:true});
}

gameSpeedRangeEl?.addEventListener('input',()=>setSettingsSpeed(gameSpeedRangeEl.value));
gameSpeedValueEl?.addEventListener('click', startCustomSpeedInput);

function settingsStatBlock(type){
  const stat=getBlockStat(type);
  const count=state?.bag?.filter(b=>b?.type===type).length || 0;
  const level=getBlockStatLevel(type);
  return `
    <div class="settings-stat-card">
      <div class="settings-stat-title">${TYPE_LABEL[type]}</div>
      <div class="settings-stat-grid">
        <span>Kho</span><strong>${formatNumber(count)}</strong>
        <span>Cấp</span><strong>Lv.${formatNumber(level)}</strong>
        <span>Đã đặt</span><strong>${formatNumber(stat.placed)}</strong>
        <span>Bóng đi qua</span><strong>${formatNumber(stat.passed)}</strong>
        <span>Đã mất</span><strong>${formatNumber(stat.lost)}</strong>
      </div>
    </div>`;
}

function settingsCardStatRows(defs, counts, valueLabel){
  return defs.map(def=>{
    const value=Math.max(0,Math.floor(Number(counts?.[def.id])||0));
    return `<div class="settings-list-row"><span>${def.name}</span><strong>${valueLabel} ${formatNumber(value)}</strong></div>`;
  }).join('');
}

function refreshSettingsStats(){
  if(!state) return;
  ensureRunStats();
  if(statsBlocksPanelEl){
    statsBlocksPanelEl.innerHTML=`<div class="settings-stat-cards">${STAT_BLOCK_TYPES.map(settingsStatBlock).join('')}</div>`;
  }
  if(statsUpgradesPanelEl){
    statsUpgradesPanelEl.innerHTML=`<div class="settings-list">${settingsCardStatRows(UPGRADE_POOL, state.stats.upgrades, 'Đã dùng:')}</div>`;
  }
  if(statsBuffsPanelEl){
    statsBuffsPanelEl.innerHTML=`<div class="settings-list">${settingsCardStatRows(BUFF_POOL, state.stats.buffs, 'Đã mua:')}</div>`;
  }
}

function setStatsSubTab(name){
  const tabs={blocks:statsBlocksTabEl, upgrades:statsUpgradesTabEl, buffs:statsBuffsTabEl};
  const panels={blocks:statsBlocksPanelEl, upgrades:statsUpgradesPanelEl, buffs:statsBuffsPanelEl};
  Object.entries(tabs).forEach(([key,el])=>{
    const active=key===name;
    el?.classList.toggle('active', active);
    el?.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  Object.entries(panels).forEach(([key,el])=>{
    el?.classList.toggle('hidden', key!==name);
  });
}

function setSettingsTab(name){
  const isStats=name==='stats';
  settingsGameTabEl?.classList.toggle('active', !isStats);
  settingsStatsTabEl?.classList.toggle('active', isStats);
  settingsGameTabEl?.setAttribute('aria-selected', !isStats ? 'true' : 'false');
  settingsStatsTabEl?.setAttribute('aria-selected', isStats ? 'true' : 'false');
  settingsGamePanelEl?.classList.toggle('hidden', isStats);
  settingsStatsPanelEl?.classList.toggle('hidden', !isStats);

  // Each visit to Số liệu starts on the default Khối tab.
  if(isStats){
    refreshSettingsStats();
    setStatsSubTab('blocks');
  }
}

function openSettings(){
  // Cài đặt always opens on the Game tab.
  setSettingsTab('game');
  refreshSpeedControl();
  settingsOverlayEl?.classList.remove('hidden');
}
function closeSettings(){ settingsOverlayEl?.classList.add('hidden'); }

settingsBtnEl?.addEventListener('click', openSettings);
settingsCloseBtnEl?.addEventListener('click', closeSettings);
settingsGameTabEl?.addEventListener('click',()=>setSettingsTab('game'));
settingsStatsTabEl?.addEventListener('click',()=>setSettingsTab('stats'));
statsBlocksTabEl?.addEventListener('click',()=>setStatsSubTab('blocks'));
statsUpgradesTabEl?.addEventListener('click',()=>setStatsSubTab('upgrades'));
statsBuffsTabEl?.addEventListener('click',()=>setStatsSubTab('buffs'));
settingsOverlayEl?.addEventListener('pointerdown', e=>{ if(e.target===settingsOverlayEl) closeSettings(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && settingsOverlayEl && !settingsOverlayEl.classList.contains('hidden')) closeSettings(); });
restartGameBtnEl?.addEventListener('click',()=>{
  closeSettings();
  newRun();
});

setStatsSubTab('blocks');
refreshSpeedControl();
