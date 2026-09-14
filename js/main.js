// ---------- persistence boot / lifecycle ----------
window.addEventListener('pagehide', flushAutoSave);
window.addEventListener('beforeunload', flushAutoSave);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden') flushAutoSave();
});

// Catch state mutations that use renderShop()/render() paths we don't explicitly hook.
setInterval(()=>{
  if(state && !state.resolving) saveGame({silent:true});
}, 2500);

if(!loadGame()){
  newRun();
} else {
}

