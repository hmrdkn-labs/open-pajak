import { describe, expect, test, vi } from 'vitest'
import { PPH22_RATES } from './constants'
import { calculatePph22 } from './pph22'
import { PPH22_ORACLE, rate  } from './check/oracle'
import { SEED, brutoGrid, int, mulberry32 } from './check/domain'
import { counterexample, expectClean, flatRate, nonPositiveBase, run } from './check/properties'
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
  // Engine-arithmetic characterization: the sourced rates, rounded to the nearest rupiah as the engine does.
  // This is NOT regulatory verification of the amount: Pasal 2(5) rounds down to thousands (counterexample below).
  test('sourced rates equal the oracle, at the engine rounding; unverified rows are skipped', () => {
    for (const [key, row] of sourced) expect(PPH22_RATES[key as PPh22TransactionType], `${key}: ${row.note}`).toBe(row.bps)
    expectClean(flatRate('PPH22-ORACLE-RATES', run22(calculatePph22), oracleRates))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH22-ROUNDING-THOUSAND: PMK 34/PMK.010/2017 Pasal 2(5) "dibulatkan ke bawah dalam
  // ribuan rupiah penuh"; the engine rounds to the nearest rupiah (nilai impor 1.234.567 at 2,5%: engine 30.864, rule 30.000).
  counterexample('PPh 22 levy is rounded down to full thousands of rupiah', () => flatRate('PPH22-ROUNDING-THOUSAND', run22(calculatePph22), oracleRates, 'thousand'))

  test('tax = DPP x rate rounded to the nearest rupiah (engine characterization), for every type', () => {
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

  test('positive control: an engine that floors to thousands satisfies the thousand oracle', async () => {
    const floorThousand = await load(() =>
      vi.doMock('./utils', async (importOriginal) => ({
        ...(await importOriginal<typeof UtilsModule>()),
        applyRate: (amount: number, bps: number) => Math.floor(Number((BigInt(Math.round(amount)) * BigInt(bps)) / 10_000n) / 1000) * 1000,
      })),
    )
    const report = flatRate('PPH22-ROUNDING-THOUSAND', run22(floorThousand), oracleRates, 'thousand')
    console.info(`[check] CONTROL-PPH22-THOUSAND violations=${report.violations}`)
    expect(report.violations).toBe(0)
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
