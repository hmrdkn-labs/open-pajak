import { describe, expect, test, vi } from 'vitest'
import { PPH23_RATES } from './constants'
import { calculatePph23 } from './pph23'
import { PPH23_ORACLE } from './check/oracle'
import { brutoGrid } from './check/domain'
import { expectClean, flatRate, nonPositiveBase, run } from './check/properties'
import type { PPh23ServiceType } from './pph23'
import type * as UtilsModule from './utils'
import type * as ConstantsModule from './constants'

type Engine = typeof calculatePph23
const types = Object.keys(PPH23_RATES) as Array<PPh23ServiceType>
const run23 = (engine: Engine) => (key: string, base: number) => engine({ serviceType: key as PPh23ServiceType, grossAmount: base, isFinal: false }).totalTax
const confirmed = Object.entries(PPH23_ORACLE).filter(([, row]) => row.confidence === 'confirmed').map(([key, row]) => ({ key, bps: row.bps }))

describe('PPh 23', () => {
  test('rows confirmed against the regulations equal the oracle', () => {
    for (const { key, bps } of confirmed) expect(PPH23_RATES[key as PPh23ServiceType], key).toBe(bps)
    expectClean(flatRate('PPH23-ORACLE-RATES', run23(calculatePph23), confirmed))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH23-KONSULTAN: constants.ts has 4% for jasa konsultan; PMK 141/PMK.03/2015 lists 2%.
  // [INFERENCE] The regulation rate is from the checker's knowledge; Dika to confirm before any fix.
  test.fails('jasa konsultan is 2%', () => {
    expectClean(flatRate('PPH23-KONSULTAN', run23(calculatePph23), [{ key: 'jasaKonsultan', bps: PPH23_ORACLE.jasaKonsultan.bps }]), 1250)
  })

  test('tax = bruto x rate rounded to the nearest rupiah, for every type', () => {
    expectClean(flatRate('PPH23-ROUNDING', run23(calculatePph23), types.map((key) => ({ key, bps: PPH23_RATES[key] }))))
  })

  test('isFinal changes the note, never the amount', () => {
    const rows = types.flatMap((type) => brutoGrid(2000).map((gross) => ({ type, gross })))
    expectClean(
      run('PPH23-FINAL-FLAG', rows, (c) => {
        const a = calculatePph23({ serviceType: c.type, grossAmount: c.gross, isFinal: true }).totalTax
        const b = calculatePph23({ serviceType: c.type, grossAmount: c.gross, isFinal: false }).totalTax
        return a === b ? null : `${c.type} gross=${c.gross} final=${a} creditable=${b}`
      }),
    )
  })

  test('zero and negative bases owe nothing', () => {
    expectClean(nonPositiveBase('PPH23-NON-POSITIVE', run23(calculatePph23), types))
  })
})

describe('negative controls: mutants must be rejected', () => {
  async function load(setup: () => void): Promise<Engine> {
    vi.resetModules()
    setup()
    const mod = await import('./pph23')
    vi.doUnmock('./utils')
    vi.doUnmock('./constants')
    vi.resetModules()
    return mod.calculatePph23
  }

  test('mutant 1: tax truncated instead of rounded', async () => {
    const mutant = await load(() =>
      vi.doMock('./utils', async (importOriginal) => ({
        ...(await importOriginal<typeof UtilsModule>()),
        applyRate: (amount: number, bps: number) => Number((BigInt(Math.round(amount)) * BigInt(bps)) / 10_000n),
      })),
    )
    const report = flatRate('PPH23-ROUNDING', run23(mutant), types.map((key) => ({ key, bps: PPH23_RATES[key] })))
    console.info(`[check] MUTANT-PPH23-TRUNCATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 2: dividen rate changed to 10%', async () => {
    const mutant = await load(() =>
      vi.doMock('./constants', async (importOriginal) => {
        const actual = await importOriginal<typeof ConstantsModule>()
        return { ...actual, PPH23_RATES: { ...actual.PPH23_RATES, dividen: 1000 } }
      }),
    )
    const report = flatRate('PPH23-ORACLE-RATES', run23(mutant), confirmed)
    console.info(`[check] MUTANT-PPH23-RATE violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })
})
