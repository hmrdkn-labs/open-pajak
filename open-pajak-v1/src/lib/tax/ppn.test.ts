import { describe, expect, test, vi } from 'vitest'
import { PPN_RATES_PER_YEAR } from './constants'
import { calculatePpn } from './ppn'
import { PPN_BPS_BY_YEAR } from './check/oracle'
import {
  PPN_UI_YEARS,
  expectClean,
  ppnCustomRate,
  ppnNonPositive,
  ppnRate,
  ppnRoundTrip,
  ppnSum,
} from './check/properties'
import type * as UtilsModule from './utils'
import type * as ConstantsModule from './constants'
import type { PpnEngine } from './check/properties'

// PMK 131/2024 "DPP nilai lain 11/12" is an OPEN TAX QUESTION (see check/RESULTS.md). These tests do not decide it:
// they compare against the statutory rate in UU 7/2021 and report what the engine does.

describe('PPN', () => {
  const engine: PpnEngine = calculatePpn

  test('every year the UI offers (2022-2025) maps to its statutory rate, exclusive and inclusive', () => {
    expect(PPN_UI_YEARS.map((year) => PPN_RATES_PER_YEAR[year])).toEqual(PPN_UI_YEARS.map((year) => PPN_BPS_BY_YEAR[year]))
    expectClean(ppnRate(engine, PPN_UI_YEARS, 'PPN-RATE-UI-YEARS'))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPN-2026: PPN_RATES_PER_YEAR has no '2026' key; ppn.ts falls back to 2024 (11%).
  // The statutory rate is 12% from 1 Jan 2025. Whether 11% is right in effect (DPP nilai lain) is not decided here.
  test.fails('taxYear 2026 uses the statutory 12%', () => {
    expectClean(ppnRate(engine, ['2026'], 'PPN-RATE-2026'))
  })

  test('DPP + PPN = total; inclusive total equals the entered price', () => {
    expectClean(ppnSum(engine))
  })

  test('exclusive then inclusive returns the DPP within Rp1', () => {
    expectClean(ppnRoundTrip(engine))
  })

  test('zero and negative bases owe nothing', () => {
    expectClean(ppnNonPositive(engine))
  })

  test('customRate is a percent and overrides the year', () => {
    expectClean(ppnCustomRate(engine))
  })
})

describe('negative controls: mutants must be rejected', () => {
  async function load(setup: () => void): Promise<PpnEngine> {
    vi.resetModules()
    setup()
    const mod = await import('./ppn')
    vi.doUnmock('./constants')
    vi.doUnmock('./utils')
    vi.resetModules()
    return mod.calculatePpn
  }

  test('mutant 1: 2025 rate left at 11%', async () => {
    const mutant = await load(() =>
      vi.doMock('./constants', async (importOriginal) => {
        const actual = await importOriginal<typeof ConstantsModule>()
        return { ...actual, PPN_RATES_PER_YEAR: { ...actual.PPN_RATES_PER_YEAR, '2025': 1100 } }
      }),
    )
    const report = ppnRate(mutant, PPN_UI_YEARS, 'PPN-RATE-UI-YEARS')
    console.info(`[check] MUTANT-PPN-RATE-2025 violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 2: exclusive PPN truncated instead of rounded', async () => {
    const mutant = await load(() =>
      vi.doMock('./utils', async (importOriginal) => {
        const actual = await importOriginal<typeof UtilsModule>()
        return { ...actual, applyRate: (amount: number, rateBps: number) => Number((BigInt(Math.round(amount)) * BigInt(rateBps)) / 10_000n) }
      }),
    )
    const report = ppnRate(mutant, PPN_UI_YEARS, 'PPN-RATE-UI-YEARS')
    console.info(`[check] MUTANT-PPN-TRUNCATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })
})
