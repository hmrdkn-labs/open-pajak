import { describe, expect, test, vi } from 'vitest'
import { PPH22_RATES } from './constants'
import { calculatePph22 } from './pph22'
import { PPH22_ORACLE, rate  } from './check/oracle'
import { SEED, brutoGrid, int, mulberry32 } from './check/domain'
import { expectClean, flatRate, nonPositiveBase, run } from './check/properties'
import type { PPh22TransactionType } from './pph22'
import type * as UtilsModule from './utils'
import type * as ConstantsModule from './constants'

// Only 'sourced' rows of PPH22_ORACLE are asserted. 'migas' and 'lainnya' are unverified and reported in RESULTS.md.
// Not modelled by the engine: the higher rate for a buyer without NPWP (RESULTS.md NO-NPWP).

type Engine = typeof calculatePph22
const types = Object.keys(PPH22_RATES) as Array<PPh22TransactionType>
const run22 = (engine: Engine) => (key: string, base: number) =>
  engine({ transactionType: key as PPh22TransactionType, transactionValue: base, otherCosts: 0, deduction: 0 }).totalTax
const sourced = Object.entries(PPH22_ORACLE).filter(([, row]) => row.confidence === 'sourced')
const oracleRates = sourced.map(([key, row]) => ({ key, bps: row.bps }))

describe('PPh 22', () => {
  test('sourced rows equal the oracle; unverified rows are skipped', () => {
    for (const [key, row] of sourced) expect(PPH22_RATES[key as PPh22TransactionType], `${key}: ${row.note}`).toBe(row.bps)
    expectClean(flatRate('PPH22-ORACLE-RATES', run22(calculatePph22), oracleRates))
  })

  test('tax = DPP x rate rounded to the nearest rupiah, for every type', () => {
    expectClean(flatRate('PPH22-ROUNDING', run22(calculatePph22), types.map((key) => ({ key, bps: PPH22_RATES[key] }))))
  })

  test('DPP = max(0, value + other costs - deduction)', () => {
    const rng = mulberry32(SEED + 22)
    const rows = types.flatMap((type) => brutoGrid(2500).map((value) => ({ type, value, other: int(rng, 1_000_000), deduction: int(rng, value + 1_000_000) })))
    expectClean(
      run('PPH22-DPP', rows, (c) => {
        const got = calculatePph22({ transactionType: c.type, transactionValue: c.value, otherCosts: c.other, deduction: c.deduction }).totalTax
        const want = rate(Math.max(0, c.value + c.other - c.deduction), PPH22_RATES[c.type], 'nearest')
        return got === want ? null : `${c.type} value=${c.value} other=${c.other} deduction=${c.deduction} engine=${got} oracle=${want}`
      }),
    )
  })

  test('zero and negative bases owe nothing', () => {
    expectClean(nonPositiveBase('PPH22-NON-POSITIVE', run22(calculatePph22), types))
  })
})

describe('negative controls: mutants must be rejected', () => {
  async function load(setup: () => void): Promise<Engine> {
    vi.resetModules()
    setup()
    const mod = await import('./pph22')
    vi.doUnmock('./utils')
    vi.doUnmock('./constants')
    vi.resetModules()
    return mod.calculatePph22
  }

  test('mutant 1: tax truncated instead of rounded', async () => {
    const mutant = await load(() =>
      vi.doMock('./utils', async (importOriginal) => ({
        ...(await importOriginal<typeof UtilsModule>()),
        applyRate: (amount: number, bps: number) => Number((BigInt(Math.round(amount)) * BigInt(bps)) / 10_000n),
      })),
    )
    const report = flatRate('PPH22-ROUNDING', run22(mutant), types.map((key) => ({ key, bps: PPH22_RATES[key] })))
    console.info(`[check] MUTANT-PPH22-TRUNCATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 2: impor rate changed to 2,0%', async () => {
    const mutant = await load(() =>
      vi.doMock('./constants', async (importOriginal) => {
        const actual = await importOriginal<typeof ConstantsModule>()
        return { ...actual, PPH22_RATES: { ...actual.PPH22_RATES, impor: 200 } }
      }),
    )
    const report = flatRate('PPH22-ORACLE-RATES', run22(mutant), oracleRates)
    console.info(`[check] MUTANT-PPH22-RATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })
})
