// src/ui/hud.js
import { RESOURCES } from '../core/store.js';
import { HEAT_MAX } from '../core/constants.js';

const ICONS = { wood: '🪵', meat: '🥩', water: '💧', stone: '🪨' };

export function createHud(root) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px',
    'display:flex', 'flex-direction:column', 'gap:6px',
    'font:600 15px system-ui', 'color:#fff',
    'text-shadow:0 1px 3px rgba(0,0,0,.6)', 'pointer-events:none',
  ].join(';');

  const rows = {};
  for (const r of RESOURCES) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.35);border-radius:14px;padding:3px 10px 3px 6px;min-width:76px';
    row.innerHTML = `<span style="font-size:17px">${ICONS[r]}</span><span data-v>0</span>`;
    panel.appendChild(row);
    rows[r] = row.querySelector('[data-v]');
  }

  const fuel = document.createElement('div');
  fuel.style.cssText = [
    'position:absolute', 'top:12px', 'left:12px',
    'font:700 15px system-ui', 'color:#ffd36e',
    'background:rgba(0,0,0,.35)', 'border-radius:14px', 'padding:4px 12px',
    'text-shadow:0 1px 3px rgba(0,0,0,.6)', 'pointer-events:none',
  ].join(';');

  root.appendChild(panel);
  root.appendChild(fuel);

  return {
    update(store, heat) {
      for (const r of RESOURCES) rows[r].textContent = String(store[r]);
      fuel.textContent = `🔥 ${Math.ceil((heat / HEAT_MAX) * 100)}%`;
    },
  };
}
