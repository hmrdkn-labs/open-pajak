// Input domain for the bounded checks: a seeded PRNG plus edge grids. Deterministic: same seed, same cases.
import { TER_BULANAN } from './oracle'

export const SEED = 20261126
export const STATUSES = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'] as const
export const GRID_SIZE = 1250 // 8 statuses x 1250 = 10,000 cases per PPh 21 property

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer in [0, max]. */
export function int(rng: () => number, max: number): number {
  return Math.floor(rng() * (max + 1))
}

/** 0, 1, 10^12 and every finite TER ceiling -1/0/+1, for all three categories. */
export function edgeValues(): Array<number> {
  const out = new Set<number>([0, 1, 1_000_000_000_000])
  for (const rows of Object.values(TER_BULANAN)) {
    for (const [ceiling] of rows) {
      if (!Number.isFinite(ceiling)) continue
      out.add(ceiling - 1)
      out.add(ceiling)
      out.add(ceiling + 1)
    }
  }
  return [...out]
}

/** Ascending, unique bruto values: the edge grid plus log-uniform seeded samples, `size` in total. */
export function brutoGrid(size: number = GRID_SIZE, seed: number = SEED): Array<number> {
  const rng = mulberry32(seed)
  const out = new Set<number>(edgeValues())
  while (out.size < size) out.add(Math.floor(10 ** (rng() * 12)))
  return [...out].sort((x, y) => x - y)
}

/** Floor every value to a multiple of `step`, drop duplicates, keep ascending order. */
export function snap(values: ReadonlyArray<number>, step: number): Array<number> {
  return [...new Set(values.map((v) => v - (v % step)))].sort((x, y) => x - y)
}

/** Snapped grid topped up with seeded samples back to `size` values. */
export function snappedGrid(step: number, size: number = GRID_SIZE, seed: number = SEED): Array<number> {
  const rng = mulberry32(seed + step)
  const out = new Set<number>(snap(brutoGrid(size, seed), step))
  while (out.size < size) out.add(Math.floor(10 ** (rng() * 12) / step) * step)
  return [...out].sort((x, y) => x - y)
}

/** `size` ascending unique values in [lo, hi], multiples of `step`: the given edges plus seeded log-uniform samples. */
export function rangeGrid(lo: number, hi: number, edges: ReadonlyArray<number>, step: number, seed: number, size: number = GRID_SIZE): Array<number> {
  const rng = mulberry32(seed)
  const out = new Set<number>(edges)
  const span = Math.log10(hi - lo + 1)
  while (out.size < size) out.add(lo + Math.floor(10 ** (rng() * span) / step) * step)
  return [...out].sort((x, y) => x - y)
}
