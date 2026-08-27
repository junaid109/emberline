// src/ui/title.js
//
// The title card. A full-screen overlay over the live 3D camp, which orbits
// slowly behind it — the backdrop costs nothing because the scene is already
// built and already rendering.
//
// The whole card is the hold surface, not just the disc. On a phone the disc is
// an indicator, not a target: making the player aim at it would be the first
// thing the game asked of them and the first thing it made awkward.
import { PLAYER_PARKA, RING_RIM } from '../render/palette.js';

const EMBER = '#' + RING_RIM.toString(16).padStart(6, '0');
const COLD = '#' + PLAYER_PARKA.toString(16).padStart(6, '0');

/** How to play, in three lines. */
// Four lines, in the order a player needs them: how to move, how to gather,
// how to spend what you gathered, and the one control nothing on screen hints
// at. The A button is listed second because "hold A" is the answer to the very
// first question a new player has, and the first playtest never found it.
const LEGEND = [
  ['Left thumb', 'walk · B to sprint'],
  ['Hold A', 'swing your pickaxe at trees, coal and wolves'],
  ['Stand on the furnace', 'feed the fire and widen the thaw'],
  ['Tap the ground', 'send your guards to a gate'],
];

// Split across two lines deliberately. As one string it wrapped mid-phrase at
// 393px, breaking "Game / Prototype" across lines.
const CREDIT_LEAD = 'AN ENTRY FOR THE';
const CREDIT_EVENT = 'Meta Horizon Creator Competition · Game Prototype · 2026';

function el(tag, css, text) {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text) node.textContent = text;
  return node;
}

/**
 * @param {HTMLElement} root
 * @returns {{setProgress(p:number):void, held:boolean, dismiss():void, root:HTMLElement}}
 */
export function createTitle(root) {
  const card = el('div', [
    'position:fixed', 'inset:0', 'z-index:60',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:5vh',
    'padding:8vmin 7vmin', 'box-sizing:border-box',
    'text-align:center', 'color:#eaf2fa',
    'font:600 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    // A vignette rather than a flat wash: the camp stays legible through the
    // middle, so the first thing the player sees is the game, not a menu.
    'background:radial-gradient(120% 80% at 50% 42%,rgba(6,11,20,.35) 0%,rgba(6,11,20,.86) 62%,rgba(4,7,13,.96) 100%)',
    'pointer-events:auto', '-webkit-user-select:none', 'user-select:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:none',
  ].join(';'));

  // --- wordmark ------------------------------------------------------------
  const head = el('div', 'display:flex;flex-direction:column;align-items:center;gap:10px');

  const title = el('div', [
    'font:800 clamp(38px,13vw,64px) system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    'letter-spacing:.14em', 'margin-right:-.14em',      // trailing letter-space, optically re-centred
    `color:${EMBER}`, 'text-shadow:0 0 26px rgba(255,140,26,.45)',
  ].join(';'), 'EMBERLINE');

  const tagline = el('div', [
    'font:600 clamp(13px,3.6vw,16px) system-ui', 'color:#9fb6c9',
    'letter-spacing:.03em',
  ].join(';'), 'The furnace is the map.');

  head.append(title, tagline);

  // --- the hold disc -------------------------------------------------------
  // A ring that fills. The game's own symbol, on screen before the game has
  // explained anything: the heat ring is a circle whose radius is your fuel,
  // and the first thing the player ever does is fill one.
  const SIZE = 'clamp(132px,38vw,168px)';
  const dial = el('div', [
    `width:${SIZE}`, `height:${SIZE}`, 'border-radius:50%',
    'display:grid', 'place-items:center', 'position:relative',
    'flex:0 0 auto',
  ].join(';'));

  const track = el('div', [
    'position:absolute', 'inset:0', 'border-radius:50%',
    'background:rgba(255,255,255,.10)',
  ].join(';'));

  const fill = el('div', [
    'position:absolute', 'inset:0', 'border-radius:50%',
    `background:conic-gradient(${EMBER} 0deg, ${EMBER} 0deg, transparent 0deg)`,
  ].join(';'));

  // Punches the middle out of the two discs above, leaving an annulus.
  const hole = el('div', [
    'position:absolute', 'inset:9px', 'border-radius:50%',
    'background:rgba(8,13,22,.92)',
    'display:grid', 'place-items:center',
  ].join(';'));

  const label = el('div', [
    'font:800 clamp(12px,3.2vw,14px) system-ui', 'letter-spacing:.12em',
    'color:#eaf2fa', 'line-height:1.5', 'margin-right:-.12em',
  ].join(';'));
  label.append(
    el('div', 'opacity:.62;font-weight:700', 'HOLD TO'),
    el('div', `color:${EMBER}`, 'LIGHT THE FIRE')
  );
  hole.append(label);
  dial.append(track, fill, hole);

  // --- legend --------------------------------------------------------------
  const legend = el('div', [
    'display:flex', 'flex-direction:column', 'gap:7px',
    'font:600 clamp(12px,3.3vw,14px) system-ui', 'color:#8fa4b8',
  ].join(';'));
  for (const [gesture, effect] of LEGEND) {
    const row = el('div', 'display:flex;gap:8px;justify-content:center;align-items:baseline');
    row.append(
      el('span', `color:${COLD};font-weight:700`, gesture),
      el('span', 'opacity:.85', effect)
    );
    legend.append(row);
  }

  const credit = el('div', [
    'position:absolute', 'left:5vmin', 'right:5vmin', 'bottom:max(14px,3.5vh)',
    'display:flex', 'flex-direction:column', 'gap:4px',
    'color:#5f7286', 'line-height:1.35',
  ].join(';'));
  credit.append(
    el('div', 'font:700 clamp(9px,2.3vw,10px) system-ui;letter-spacing:.18em;opacity:.75', CREDIT_LEAD),
    el('div', 'font:600 clamp(10px,2.7vw,12px) system-ui;letter-spacing:.01em', CREDIT_EVENT)
  );

  card.append(head, dial, legend, credit);
  root.append(card);

  const api = {
    held: false,
    root: card,

    /** @param {number} p 0..1 */
    setProgress(p) {
      const deg = Math.max(0, Math.min(1, p)) * 360;
      fill.style.background =
        `conic-gradient(${EMBER} 0deg ${deg}deg, transparent ${deg}deg 360deg)`;
      // The card breathes toward the fire as the hold completes, so the player
      // can feel it working without looking away from their thumb.
      card.style.opacity = String(1 - 0.25 * p);
      dial.style.transform = `scale(${1 + 0.06 * p})`;
    },

    dismiss() {
      card.remove();
    },
  };

  const down = () => { api.held = true; };
  const up = () => { api.held = false; };

  card.addEventListener('pointerdown', down);
  // pointerup alone is not enough: a thumb dragged off the glass, or a call
  // arriving, fires cancel or leave instead and would otherwise leave the card
  // holding itself down forever.
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    card.addEventListener(type, up);
  }

  api.setProgress(0);
  return api;
}
