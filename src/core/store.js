// src/core/store.js

// Three resources, and every one of them is really gathered and really spent.
//
// There were four. 'stone' became 'coal' because a stone does not burn: coal is
// a second FUEL, which deepens the loop the game already has instead of opening
// a second one beside it. Water never became anything — it sat in the HUD as a
// permanent zero, promising an economy that did not exist. The submission
// checklist is explicit that nothing may be "half-finished or left in as a
// stub", and a counter that can never move is exactly that, so it is gone.
export const RESOURCES = ['wood', 'coal', 'meat'];

export function createStore() {
  return { wood: 0, coal: 0, meat: 0 };
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
