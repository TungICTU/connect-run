// ---------- number formatting ----------
// Hiển thị số với dấu phân cách hàng nghìn: 1,000 / 1,000,000 / ...
// Khi vượt quá 999,999,999, chuyển sang dạng khoa học: 1.0e+9, ...
const NUMBER_FORMAT_LIMIT = 999_999_999;
const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  useGrouping: true
});

function formatNumber(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return String(value ?? 0);
  if(Math.abs(n) > NUMBER_FORMAT_LIMIT){
    const exp = Math.floor(Math.log10(Math.abs(n)));
    const mantissa = n / Math.pow(10, exp);
    return `${mantissa.toFixed(1)}e+${exp}`;
  }
  return numberFormatter.format(Math.round(n));
}

function formatMoney(value){
  return `$${formatNumber(value)}`;
}


// ---------- animation speed ----------
const GAME_SPEED_STORAGE_KEY = 'connect-run-speed-v1';
const GAME_SPEED_MIN = 0.10;
const GAME_SPEED_MAX = 5.00;
const GAME_SPEED_STEP = 0.01;

function normalizeAnimationSpeed(value){
  let next = Number(value);
  if(!Number.isFinite(next)) next = 1;
  next = Math.max(GAME_SPEED_MIN, Math.min(GAME_SPEED_MAX, next));
  next = Math.round(next * 100) / 100;
  return next;
}

function loadStoredAnimationSpeed(){
  try{
    return normalizeAnimationSpeed(localStorage.getItem(GAME_SPEED_STORAGE_KEY) ?? 1);
  }catch{
    return 1;
  }
}

let animationSpeed = loadStoredAnimationSpeed();

function setAnimationSpeed(value, persist=true){
  const next = normalizeAnimationSpeed(value);
  animationSpeed = next;
  document.documentElement.style.setProperty('--anim-speed', String(next));
  if(persist){
    try{ localStorage.setItem(GAME_SPEED_STORAGE_KEY, next.toFixed(2)); }catch{}
  }
  return next;
}

// Single source of truth for the displayed score size used by:
// 1) the ball-contained score tooltip,
// 2) the score popup when the ball reaches the hole, and
// 3) the ball score shake/grow animation (via the same computed font size).
const SCORE_DISPLAY_BASE_FONT_SIZE = 18;
document.documentElement.style.setProperty('--score-display-base-font-size', `${SCORE_DISPLAY_BASE_FONT_SIZE}px`);
setAnimationSpeed(animationSpeed, false);

function scaledDuration(ms){ return ms / animationSpeed; }

