import { describe, expect, test, vi } from 'vitest'
import { PPH4_2_RATES } from './constants'
import { calculatePph4 } from './pph4_2'
import { PPH4_2_ORACLE } from './check/oracle'
import { expectClean, flatRate, nonPositiveBase } from './check/properties'
import type { PPh4Objek } from './pph4_2'
import type * as UtilsModule from './utils'
import type * as ConstantsModule from './constants'

// 'konstruksi' (rate depends on the contractor class) and 'restoran' (restaurant tax is a regional tax, not PPh 4(2))
// cannot be pinned to one regulation rate; they are reported in RESULTS.md (PPH4_2-UNVERIFIED), not asserted.

type Engine = typeof calculatePph4
const objects = Object.keys(PPH4_2_RATES) as Array<PPh4Objek>
const run42 = (engine: Engine) => (key: string, base: number) => engine({ objectType: key as PPh4Objek, grossAmount: base }).totalTax
const oracleRates = Object.entries(PPH4_2_ORACLE).map(([key, row]) => ({ key, bps: row.bps }))

describe('PPh Final 4(2)', () => {
  test('rows with a single regulation rate equal the oracle', () => {
    for (const [key, row] of Object.entries(PPH4_2_ORACLE)) expect(PPH4_2_RATES[key as PPh4Objek], `${key}: ${row.note}`).toBe(row.bps)
    expectClean(flatRate('PPH4_2-ORACLE-RATES', run42(calculatePph4), oracleRates))
  })

  test('tax = bruto x rate rounded to the nearest rupiah, for every object', () => {
    expectClean(flatRate('PPH4_2-ROUNDING', run42(calculatePph4), objects.map((key) => ({ key, bps: PPH4_2_RATES[key] }))))
  })

  test('zero and negative bases owe nothing', () => {
    expectClean(nonPositiveBase('PPH4_2-NON-POSITIVE', run42(calculatePph4), objects))
  })
})

describe('negative controls: mutants must be rejected', () => {
  async function load(setup: () => void): Promise<Engine> {
    vi.resetModules()
    setup()
    const mod = await import('./pph4_2')
    vi.doUnmock('./utils')
    vi.doUnmock('./constants')
    vi.resetModules()
    return mod.calculatePph4
  }

  test('mutant 1: tax truncated instead of rounded', async () => {
    const mutant = await load(() =>
      vi.doMock('./utils', async (importOriginal) => ({
        ...(await importOriginal<typeof UtilsModule>()),
        applyRate: (amount: number, bps: number) => Number((BigInt(Math.round(amount)) * BigInt(bps)) / 10_000n),
      })),
    )
    const report = flatRate('PPH4_2-ROUNDING', run42(mutant), objects.map((key) => ({ key, bps: PPH4_2_RATES[key] })))
    console.info(`[check] MUTANT-PPH4_2-TRUNCATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 2: umkmFinal rate changed to 1%', async () => {
    const mutant = await load(() =>
      vi.doMock('./constants', async (importOriginal) => {
        const actual = await importOriginal<typeof ConstantsModule>()
        return { ...actual, PPH4_2_RATES: { ...actual.PPH4_2_RATES, umkmFinal: 100 } }
      }),
    )
    const report = flatRate('PPH4_2-ORACLE-RATES', run42(mutant), oracleRates)
    console.info(`[check] MUTANT-PPH4_2-RATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })
})
