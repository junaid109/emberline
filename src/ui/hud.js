// src/ui/hud.js
import { RESOURCES } from '../core/store.js';
import { HEAT_MAX, TOTAL_NIGHTS } from '../core/constants.js';
import { EVENT_LABEL } from '../core/weather.js';

const ICONS = { wood: '🪵', coal: '🪨', meat: '🥩', water: '💧' };

const PHASE_LABEL = {
  day: 'DAY',
  dusk: 'THEY ARE COMING',
  night: 'NIGHT',
  dawn: 'DAWN',
};

const PHASE_COLOR = {
  day: '#eaf2fa',
  dusk: '#ff6b5a',
  night: '#9fc6ff',
  dawn: '#ffd36e',
};

const PILL = 'background:rgba(0,0,0,.38);border-radius:14px;text-shadow:0 1px 3px rgba(0,0,0,.6)';

export function createHud(root) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px',
    'display:flex', 'flex-direction:column', 'gap:6px',
    'font:600 15px system-ui', 'color:#fff',
    'text-shadow:0 1px 3px rgba(0,0,0,.6)', 'pointer-events:none',
  ].join(';');

  const rows = {};
  const lastValues = {};
  for (const r of RESOURCES) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:6px;${PILL};padding:3px 10px 3px 6px;min-width:76px`;
    row.innerHTML = `<span style="font-size:17px">${ICONS[r]}</span><span data-v>0</span>`;
    panel.appendChild(row);
    rows[r] = row.querySelector('[data-v]');
    lastValues[r] = '0';
  }

  const fuel = document.createElement('div');
  fuel.style.cssText = [
    'position:absolute', 'top:12px', 'left:12px',
    'font:700 15px system-ui', 'color:#ffd36e', PILL,
    'padding:4px 12px', 'pointer-events:none',
  ].join(';');

  // Phase banner, centred at the top. This is the only element that tells the
  // player a night is coming, so it is the widest and highest-contrast thing
  // on screen during dusk.
  const banner = document.createElement('div');
  banner.style.cssText = [
    'position:absolute', 'top:44px', 'left:50%', 'transform:translateX(-50%)',
    'font:800 13px system-ui', 'letter-spacing:.14em', 'text-align:center',
    PILL, 'padding:5px 14px', 'white-space:nowrap', 'pointer-events:none',
  ].join(';');

  // End-of-run card. pointer-events stay off so a stray tap cannot dismiss it
  // before the player has read it; the restart control is enabled explicitly.
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'display:none',
    'flex-direction:column', 'align-items:center', 'justify-content:center', 'gap:18px',
    'background:rgba(6,11,20,.86)', 'color:#eaf2fa',
    'font:700 22px system-ui', 'text-align:center', 'padding:8vmin',
    'pointer-events:auto', 'z-index:50',
  ].join(';');

  const overlayTitle = document.createElement('div');
  overlayTitle.style.cssText = 'font:800 30px system-ui';
  const overlayBody = document.createElement('div');
  overlayBody.style.cssText = 'font:600 16px system-ui;color:#9fb6c9;line-height:1.5';
  const restart = document.createElement('button');
  restart.textContent = 'Run it again';
  restart.style.cssText = [
    'font:700 17px system-ui', 'color:#0d1b2a', 'background:#ffd36e',
    'border:0', 'border-radius:999px', 'padding:13px 30px', 'cursor:pointer',
    // 44px is the minimum comfortable touch target on a phone.
    'min-height:44px', 'min-width:160px',
  ].join(';');
  overlay.append(overlayTitle, overlayBody, restart);

  root.append(panel, fuel, banner, overlay);

  let lastFuel = null;
  let lastBanner = null;
  let lastOver = undefined;

  // The HUD is built at boot but must not be on screen during the title card:
  // four resource counters reading zero, over a card telling the player what
  // the game is, answers a question nobody has asked yet.
  // A day's weather, announced once and then faded. Placed below the phase
  // banner rather than replacing it: what phase it is never stops mattering,
  // and an event that hid the clock would be a worse trade than no event.
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:absolute', 'top:78px', 'left:50%', 'transform:translateX(-50%)',
    'font:800 13px system-ui', 'letter-spacing:.14em', 'white-space:nowrap',
    'padding:5px 14px', PILL, 'color:#9fe8b4',
    'pointer-events:none', 'opacity:0', 'transition:opacity .5s ease',
  ].join(';');
  root.append(toast);

  let toastTimer = null;

  const chrome = [panel, fuel, banner];
  const shown = chrome.map((n) => n.style.display || '');
  for (const n of chrome) n.style.display = 'none';

  return {
    /**
     * Announces the day's weather, once.
     *
     * A calm day says nothing at all: an "ALL CLEAR" every other morning would
     * train the player to stop reading the one line that matters when it is not.
     */
    announce(event) {
      const label = EVENT_LABEL[event];
      if (!label) return;

      toast.textContent = label;
      toast.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3200);
    },

    /** @param {boolean} on shows or hides the live HUD (not the end-of-run card) */
    setVisible(on) {
      chrome.forEach((n, i) => { n.style.display = on ? shown[i] : 'none'; });
      if (!on) toast.style.opacity = '0';
    },

    /** @param {() => void} fn called when the player asks for another run */
    onRestart(fn) {
      restart.addEventListener('click', fn);
    },

    update(world, remaining) {
      for (const r of RESOURCES) {
        const v = String(world.store[r]);
        if (v !== lastValues[r]) {
          rows[r].textContent = v;
          lastValues[r] = v;
        }
      }

      const fuelText = `🔥 ${Math.ceil((world.heat / HEAT_MAX) * 100)}%`;
      if (fuelText !== lastFuel) {
        fuel.textContent = fuelText;
        lastFuel = fuelText;
      }

      const { phase, night } = world.cycle;
      const bannerText = phase === 'dusk'
        ? PHASE_LABEL.dusk
        : `${PHASE_LABEL[phase]} ${night}/${TOTAL_NIGHTS} · ${Math.ceil(remaining)}s`;
      if (bannerText !== lastBanner) {
        banner.textContent = bannerText;
        banner.style.color = PHASE_COLOR[phase];
        lastBanner = bannerText;
      }

      if (world.over !== lastOver) {
        lastOver = world.over;
        if (world.over) {
          overlayTitle.textContent = world.over === 'won' ? 'The fire held.' : 'The fire went out.';
          overlayBody.textContent = world.over === 'won'
            ? `Seven nights. ${world.store.wood} wood burned, ${world.kills} wolves turned back.`
            : `You made it to night ${night} of ${TOTAL_NIGHTS}.`;
          overlay.style.display = 'flex';
        } else {
          overlay.style.display = 'none';
        }
      }
    },
  };
}
