// src/ui/buttons.js
//
// The two right-hand buttons.
//
// Straight out of the first phone playtest: "we should add an attack button and
// a sprint button, A B on the right hand side, like a Game Boy." The note under
// the note was that the game gave a player nothing to press — walking was the
// entire input, gathering happened by standing still, and a wolf on the furnace
// had no answer at all.
//
// They are laid out on the Game Boy diagonal (B up and left of A) because that
// is the shape a thumb already knows, and sized well past the 44px touch
// minimum since the whole point is that they are hit without looking.

const SIZE = 78;

/**
 * @param {HTMLElement} root the #ui overlay
 * @returns {{a:{held:boolean}, b:{held:boolean}, setStamina(t:number):void,
 *            setVisible(on:boolean):void, root:HTMLElement}}
 */
export function createButtons(root) {
  const pad = document.createElement('div');
  pad.style.cssText = [
    'position:absolute',
    // Sat above the very bottom edge: a control flush with the screen bottom
    // fights the phone's own home-swipe gesture.
    'right:18px', 'bottom:96px',
    'width:190px', 'height:170px',
    'pointer-events:none',
    'touch-action:none',              // never let a press scroll or zoom the page
    'user-select:none', '-webkit-user-select:none',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');

  /**
   * One round button.
   *
   * The caption is not decoration: "A" alone says nothing to someone opening
   * this for the first time, and a judge plays exactly one sitting.
   */
  function makeButton(letter, glyph, caption, tint, x, y) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      `left:${x}px`, `top:${y}px`,
      `width:${SIZE}px`, `height:${SIZE}px`,
      'border-radius:50%',
      `background:${tint}`,
      'border:2px solid rgba(255,255,255,.55)',
      'box-shadow:0 4px 14px rgba(0,0,0,.45)',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'font:700 11px system-ui', 'color:#fff', 'letter-spacing:.06em',
      'text-shadow:0 1px 3px rgba(0,0,0,.7)',
      'pointer-events:auto',
      'touch-action:none',
      'transition:transform .06s ease-out, filter .06s ease-out',
    ].join(';');
    el.innerHTML =
      `<span style="font-size:26px;line-height:1">${glyph}</span>` +
      `<span style="opacity:.95;margin-top:2px">${caption}</span>` +
      `<span style="position:absolute;top:4px;left:9px;font:800 12px system-ui;opacity:.75">${letter}</span>`;

    const state = { held: false };

    const down = (e) => {
      e.preventDefault();          // stop the press becoming a scroll or a text selection
      state.held = true;
      el.style.transform = 'scale(0.92)';
      el.style.filter = 'brightness(1.35)';
    };
    const up = () => {
      state.held = false;
      el.style.transform = 'scale(1)';
      el.style.filter = 'none';
    };

    el.addEventListener('pointerdown', down);
    // Every way a press can end, including the thumb sliding off the button —
    // without pointerleave a finger dragged off would leave the input stuck on.
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(type, up);
    }

    pad.appendChild(el);
    return { el, state };
  }

  // B sits up and left of A, the Game Boy diagonal.
  const b = makeButton('B', '»', 'RUN', 'rgba(46,120,198,.72)', 8, 12);
  const a = makeButton('A', '⛏', 'MINE', 'rgba(198,86,46,.78)', 104, 66);

  // The stamina ring wraps the sprint button, so the cost of holding it is
  // read in the same glance as the button itself rather than from a bar
  // somewhere else on screen.
  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute', 'left:2px', 'top:6px',
    `width:${SIZE + 12}px`, `height:${SIZE + 12}px`,
    'border-radius:50%', 'pointer-events:none',
  ].join(';');
  pad.insertBefore(ring, b.el);

  root.appendChild(pad);

  return {
    a: a.state,
    b: b.state,
    root: pad,

    /** @param {number} t stamina, 0 to 1 */
    setStamina(t) {
      const deg = Math.max(0, Math.min(1, t)) * 360;
      // Red once it is nearly gone: the moment the sprint is about to cut out
      // is exactly when the player needs to know.
      const color = t < 0.25 ? '#ff6a52' : '#8ad3ff';
      ring.style.background =
        `conic-gradient(${color} ${deg}deg, rgba(255,255,255,.12) ${deg}deg)`;
      ring.style.opacity = t >= 1 ? '0.35' : '1';
    },

    setVisible(on) {
      pad.style.display = on ? 'block' : 'none';
    },
  };
}
