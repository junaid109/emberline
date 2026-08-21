// src/core/store.js

export const RESOURCES = ['wood', 'meat', 'water', 'stone'];

export function createStore() {
  return { wood: 0, meat: 0, water: 0, stone: 0 };
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
