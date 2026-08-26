// src/core/store.js

// Four slots, and for a long time three of them were permanently zero — the HUD
// promised an economy the game did not have. 'stone' became 'coal' because a
// stone does not burn: coal is a second FUEL, which deepens the loop the game
// already has instead of opening a second one beside it.
export const RESOURCES = ['wood', 'coal', 'meat', 'water'];

export function createStore() {
  return { wood: 0, coal: 0, meat: 0, water: 0 };
}

export function storeAdd(store, kind, n = 1) {
  store[kind] += n;
  return store[kind];
}

export function storeSpend(store, kind, n) {
  if (store[kind] < n) return false;
  store[kind] -= n;
  return true;
}
