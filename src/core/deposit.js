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

export function tickDeposit(dep, dt, onPad, carry, store) {
  const kinds = [];

  if (onPad && carryTotal(carry) > 0) {
    dep.timer += dt;
    while (dep.timer >= DEPOSIT_INTERVAL && carryTotal(carry) > 0) {
      dep.timer -= DEPOSIT_INTERVAL;
      const kind = carryPop(carry);
      storeAdd(store, kind, 1);
      kinds.push(kind);
    }
  } else {
    dep.timer = 0;
  }

  return kinds;
}
