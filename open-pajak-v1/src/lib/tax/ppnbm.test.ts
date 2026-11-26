import { describe, expect, test, vi } from 'vitest'
import { PPNBM_RATES } from './constants'
import { calculatePpnbm } from './ppnbm'
import { expectClean, flatRate, nonPositiveBase } from './check/properties'
import type { PpnbmGoods } from './ppnbm'
import type * as UtilsModule from './utils'

// No source in the repo or the guide pins the PPnBM rates (RESULTS.md PPNBM-RATES): these tests check the
// arithmetic (rate x base, rounding, clamps) at whatever rate the engine holds, and custom rates against the oracle.

type Engine = typeof calculatePpnbm
const goods = Object.keys(PPNBM_RATES) as Array<PpnbmGoods>
const engineRates = goods.map((key) => ({ key, bps: PPNBM_RATES[key] }))
const byGoods = (engine: Engine) => (key: string, base: number) => engine({ goodsType: key as PpnbmGoods, dppPpn: base }).totalTax
const byCustom = (engine: Engine) => (key: string, base: number) => engine({ goodsType: 'perhiasan', dppPpn: base, customRate: Number(key) }).totalTax

describe('PPnBM', () => {
  test('tax = DPP x rate, rounded to the nearest rupiah, for each goods type', () => {
    expectClean(flatRate('PPNBM-ROUNDING', byGoods(calculatePpnbm), engineRates))
  })

  test('customRate is a percent and overrides the goods rate', () => {
    const custom = [12.5, 20, 35, 40.25, 75].map((pct) => ({ key: String(pct), bps: Math.round(pct * 100) }))
    expectClean(flatRate('PPNBM-CUSTOM-RATE', byCustom(calculatePpnbm), custom))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPNBM-NEGATIVE: ppnbm.ts does not clamp dppPpn, so a negative DPP gives a negative tax.
  test.fails('a negative DPP owes nothing', () => {
    expectClean(nonPositiveBase('PPNBM-NEGATIVE', byGoods(calculatePpnbm), goods))
  })
})

describe('negative controls: mutants must be rejected', () => {
  async function load(applyRate: (amount: number, rateBps: number) => number): Promise<Engine> {
    vi.resetModules()
    vi.doMock('./utils', async (importOriginal) => ({ ...(await importOriginal<typeof UtilsModule>()), applyRate }))
    const mod = await import('./ppnbm')
    vi.doUnmock('./utils')
    vi.resetModules()
    return mod.calculatePpnbm
  }

  test('mutant 1: tax truncated instead of rounded', async () => {
    const mutant = await load((amount, bps) => Number((BigInt(Math.round(amount)) * BigInt(bps)) / 10_000n))
    const report = flatRate('PPNBM-ROUNDING', byGoods(mutant), engineRates)
    console.info(`[check] MUTANT-PPNBM-TRUNCATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 2: rate scale off by ten', async () => {
    const mutant = await load((amount, bps) => Math.round((amount * bps) / 1000))
    const report = flatRate('PPNBM-ROUNDING', byGoods(mutant), engineRates)
    console.info(`[check] MUTANT-PPNBM-SCALE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })
})
