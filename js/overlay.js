// ---------- overlay ----------
const overlayEl = document.getElementById('overlay');
const overlayPanelEl = document.getElementById('overlayPanel');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
function showOverlay(kind, title, text){
  overlayEl.classList.remove('reward-clear');
  overlayPanelEl.className = 'overlay-panel ' + kind;
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayTextEl.style.textAlign='center';
  overlayTextEl.style.lineHeight='normal';
  const btn=document.getElementById('overlayBtn');
  btn.className='';
  btn.textContent='Chơi lại từ đầu';
  btn.onclick=newRun;
  overlayEl.classList.remove('hidden');
}
function hideOverlay(){ overlayEl.classList.add('hidden'); overlayEl.classList.remove('reward-clear'); }
document.getElementById('overlayBtn').onclick = newRun;
document.getElementById('newGameBtn').addEventListener('click', newRun);

