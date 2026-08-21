// src/core/carry.js

export function createCarry(cap) {
  return { cap, items: [] };
}

export function carryTotal(c) {
  return c.items.length;
}

export function carryIsFull(c) {
  return c.items.length >= c.cap;
}

export function carryAdd(c, kind) {
  if (carryIsFull(c)) return false;
  c.items.push(kind);
  return true;
}

export function carryPop(c) {
  return c.items.length === 0 ? null : c.items.pop();
}

export function carryCountOf(c, kind) {
  let n = 0;
  for (const k of c.items) if (k === kind) n++;
  return n;
}
