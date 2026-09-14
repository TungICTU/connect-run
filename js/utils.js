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
let animationSpeed = 1;

// Single source of truth for the displayed score size used by:
// 1) the ball-contained score tooltip,
// 2) the score popup when the ball reaches the hole, and
// 3) the ball score shake/grow animation (via the same computed font size).
const SCORE_DISPLAY_BASE_FONT_SIZE = 18;
document.documentElement.style.setProperty('--score-display-base-font-size', `${SCORE_DISPLAY_BASE_FONT_SIZE}px`);

const animationSpeedSelect = document.getElementById('animationSpeedSelect');
function setAnimationSpeed(value){
  const next = Number(value);
  if(!Number.isFinite(next) || next <= 0) return;
  animationSpeed = next;
  document.documentElement.style.setProperty('--anim-speed', String(next));
}
function scaledDuration(ms){ return ms / animationSpeed; }
animationSpeedSelect.addEventListener('change', ()=>setAnimationSpeed(animationSpeedSelect.value));
setAnimationSpeed(animationSpeedSelect.value);

