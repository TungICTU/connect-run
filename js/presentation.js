// Viewport fitting and boss presentation are derived from state, never saved.
const presentationApp=document.querySelector('.app');
const boardStageEl=document.querySelector('.board-stage');
const themeProperties=['--bg','--bg-deep','--panel','--panel-line','--ink-dim','--cyan','--cyan-dim','--boss-cell'];
let presentationFrame=0;
let appliedBossTheme=null;
function syncGamePresentation(){
  if(!state) return;
  document.body.classList.toggle('shop-open',state.phase==='shop');
  const boss=['playing','settling','gameover'].includes(state.phase) ? BOSS_DEFS[state.boss?.id] : null;
  const key=boss?.id || '';
  if(key!==appliedBossTheme){
    appliedBossTheme=key;
    document.body.classList.toggle('boss-theme',!!boss);
    document.body.dataset.bossTheme=key;
    const style=document.documentElement.style;
    if(!boss) themeProperties.forEach(name=>style.removeProperty(name));
    else {
      const hex=boss.color.replace('#','');
      const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
      const mix=(other,amount)=>rgb.map((v,i)=>Math.round(v*(1-amount)+other[i]*amount));
      const color=v=>`rgb(${v.join(',')})`;
      const accent=mix([255,255,255],.35);
      style.setProperty('--bg',color(mix([8,12,18],.84)));
      style.setProperty('--bg-deep',color(mix([4,7,12],.92)));
      style.setProperty('--panel',color(mix([16,21,29],.78)));
      style.setProperty('--panel-line',`rgba(${accent.join(',')},.34)`);
      style.setProperty('--ink-dim',color(mix([190,200,212],.75)));
      style.setProperty('--cyan',color(accent));
      style.setProperty('--cyan-dim',`rgba(${accent.join(',')},.35)`);
      style.setProperty('--boss-cell',`rgba(${accent.join(',')},.055)`);
    }
  }
  schedulePresentationLayout();
}
function schedulePresentationLayout(){
  if(presentationFrame) return;
  presentationFrame=requestAnimationFrame(()=>{ presentationFrame=0; fitGameViewport(); });
}
function fitGameViewport(){
  const slot=document.querySelector('.hud-location-slot');
  if(slot) document.getElementById('locationBar').style.transform=`scale(${slot.clientWidth/330})`;
  const viewport=window.visualViewport;
  const height=viewport?.height || window.innerHeight;
  document.body.style.setProperty('--viewport-height',`${height}px`);
  if(state && state.phase!=='shop'){
    const width=boardStageEl.clientWidth, availableHeight=boardStageEl.clientHeight;
    const ratio=Math.max(1,state.cols||4)/Math.max(1,state.rows||4);
    const boardWidth=Math.max(1,Math.min(width,availableHeight*ratio,560));
    boardWrapEl.style.setProperty('--fitted-board-width',`${boardWidth}px`);
    boardWrapEl.style.setProperty('--fitted-board-height',`${boardWidth/ratio}px`);
  }
  const panel=shopOverlayEl.querySelector('.shop-panel');
  if(panel && state?.phase==='shop') positionShopPanel(panel);
}
const presentationObserver=new ResizeObserver(schedulePresentationLayout);
presentationObserver.observe(presentationApp);
presentationObserver.observe(boardStageEl);
for(const el of [ballQueueEl,cardHandEl,document.querySelector('.bag-row')]) presentationObserver.observe(el);
window.addEventListener('resize',schedulePresentationLayout);
window.visualViewport?.addEventListener('resize',schedulePresentationLayout);
window.visualViewport?.addEventListener('scroll',schedulePresentationLayout);
