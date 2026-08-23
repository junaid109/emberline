// src/core/deposit.js
import { DEPOSIT_INTERVAL } from './constants.js';
import { carryPop, carryTotal } from './carry.js';
import { storeAdd } from './store.js';

export function isOnPad(px, pz, padX, padZ, padRadius) {
  const dx = px - padX;
  const dz = pz - padZ;
  return dx * dx + dz * dz <= padRadius * padRadius;
}

export function createDeposit() {
  return { timer: 0 };
}

/**
 * Advances the deposit timer and moves items from carry into store.
 * Returns an array of the kinds deposited this call, or null if nothing was
 * deposited — callers should skip iterating in the null case rather than
 * receiving (and the callee allocating) an empty array on every idle frame.
 */
export function tickDeposit(dep, dt, onPad, carry, store) {
  if (!onPad || carryTotal(carry) === 0) {
    dep.timer = 0;
    return null;
  }

  let kinds = null;
  dep.timer += dt;
  while (dep.timer >= DEPOSIT_INTERVAL && carryTotal(carry) > 0) {
    dep.timer -= DEPOSIT_INTERVAL;
    const kind = carryPop(carry);
    storeAdd(store, kind, 1);
    (kinds ?? (kinds = [])).push(kind);
  }

  return kinds;
}
