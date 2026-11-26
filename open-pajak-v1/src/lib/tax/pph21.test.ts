import { readFileSync } from 'node:fs'
import { describe, expect, test, vi } from 'vitest'
import { PASAL17_LAYERS, PTKP_TABLE, TER_BULANAN_TABLE, TER_HARIAN_TABLE } from './constants'
import { calculatePph21 } from './pph21'
import { getPTKP } from './utils'
import {
  PASAL17,
  PR17_TER_HARIAN,
  PTKP,
  PTKP_KI,
  TER_BULANAN,
  TER_CATEGORY,
  TER_HARIAN,
} from './check/oracle'
import {
  annualMonotone,
  annualPkp,
  bounds,
  counterexample,
  dailyHigh,
  dailyLow,
  december,
  decemberNegative,
  expectClean,
  flatPasal17,
  lazy,
  nonNegativeOnNegativeInput,
  partialYear,
  pensiunan12,
  pensiunanPartial,
  pensiunanTerMasa,
  pphInput,
  pttMonthly,
  terMonotone,
  terMonthly,
  wpln,
} from './check/properties'
import type * as UtilsModule from './utils'
import type * as ConstantsModule from './constants'
import type { Pph21Engine } from './check/properties'

// Known counterexamples are marked test.fails and explained in check/RESULTS.md.
// Remove test.fails once the engine is fixed and Dika has signed off the tax change.

describe('tables against the guide', () => {
  test('each TER Bulanan table: bounds strictly increase, no gaps, rates never fall, last row open', () => {
    for (const category of ['A', 'B', 'C'] as const) {
      const rows = TER_BULANAN[category]
      expect(rows[0][1], `${category} starts at 0%`).toBe(0)
      expect(rows.at(-1)?.[0], `${category} last row open ended`).toBe(Infinity)
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i][0], `${category} row ${i} bound`).toBeGreaterThan(rows[i - 1][0])
        expect(rows[i][1], `${category} row ${i} rate`).toBeGreaterThanOrEqual(rows[i - 1][1])
      }
    }
    console.info(`[check] TABLE-TER-SHAPE rows A=${TER_BULANAN.A.length} B=${TER_BULANAN.B.length} C=${TER_BULANAN.C.length}`)
  })

  test('constants.ts TER Bulanan equals the guide, row by row (p.40-42)', () => {
    const diffs: Array<string> = []
    for (const category of ['A', 'B', 'C'] as const) {
      const engine = TER_BULANAN_TABLE[category]
      const source = TER_BULANAN[category]
      if (engine.length !== source.length) diffs.push(`${category}: ${engine.length} rows, guide has ${source.length}`)
      source.forEach(([ceiling, bps], i) => {
        const row = engine.at(i)
        if (!row || row.ceiling !== ceiling || row.rateBps !== bps) diffs.push(`${category}[${i}]: engine ${JSON.stringify(row)} guide ${ceiling}/${bps}`)
      })
    }
    console.info(`[check] TABLE-TER-BULANAN differing rows=${diffs.length}`)
    expect(diffs).toEqual([])
  })

  test('constants.ts PTKP equals the guide for the 8 statuses it has (p.48)', () => {
    expect(PTKP_TABLE).toEqual(PTKP)
  })

  // COUNTEREXAMPLE, see RESULTS.md TABLE-PTKP-KI: p.48 Tabel 7.4 lists K/I/0..K/I/3; getPTKP falls back to TK/0.
  const missingKi = Object.entries(PTKP_KI).filter(([status, value]) => getPTKP(status) !== value).map(([s]) => s)
  test('K/I table of the guide has 4 statuses to look up', () => {
    console.info(`[check] TABLE-PTKP-KI statuses=${Object.keys(PTKP_KI).length} missing=${missingKi.join(',')}`)
    expect(Object.keys(PTKP_KI)).toHaveLength(4)
  })
  test.fails('engine knows every PTKP status of the guide, including K/I/0..K/I/3', () => {
    expect(missingKi).toEqual([])
  })

  test('Pasal 17 layers equal the guide (p.39)', () => {
    let upper = 0
    const cumulative = PASAL17_LAYERS.map((layer) => {
      upper += layer.limit
      return [upper, layer.rateBps] as const
    })
    expect(cumulative).toEqual(PASAL17.map(([bound, bps]) => [bound, bps]))
  })

  // COUNTEREXAMPLE, see RESULTS.md TABLE-TER-HARIAN: p.43 has one table without A/B/C; constants.ts has three tables of 3 rows.
  const harianDiffs: Array<string> = []
  for (const category of Object.keys(TER_HARIAN_TABLE)) {
    const rows = TER_HARIAN_TABLE[category]
    TER_HARIAN.forEach(([ceiling, bps], i) => {
      if (rows.at(i)?.ceiling !== ceiling || rows.at(i)?.rateBps !== bps) harianDiffs.push(`${category}[${i}]: engine ${JSON.stringify(rows.at(i))} guide ${ceiling}/${bps}`)
    })
    if (rows.length !== TER_HARIAN.length) harianDiffs.push(`${category}: ${rows.length} rows, guide has ${TER_HARIAN.length}`)
  }
  test('TER Harian: both tables are compared (3 engine categories, 2 guide rows)', () => {
    console.info(`[check] TABLE-TER-HARIAN differing rows=${harianDiffs.length}: ${harianDiffs.slice(0, 3).join(' | ')}`)
    expect(Object.keys(TER_HARIAN_TABLE)).toHaveLength(3)
    expect(TER_HARIAN).toHaveLength(2)
  })
  test.fails('constants.ts TER Harian equals the guide (p.43)', () => {
    expect(harianDiffs).toEqual([])
  })

  test('PR #17 TER Harian rows match the guide (p.43, p.89); that PR drops the A/B/C split', () => {
    expect(PR17_TER_HARIAN).toEqual(TER_HARIAN)
  })

  test('the status to TER category map in routes/pph21.tsx equals the guide for all 8 statuses', () => {
    const source = readFileSync(new URL('../../routes/pph21.tsx', import.meta.url), 'utf8')
    const block = /const PTKP_TER_MAPPING[^{]*\{([^}]*)\}/.exec(source)?.[1] ?? ''
    const found = Object.fromEntries([...block.matchAll(/'([^']+)':\s*'([ABC])'/g)].map((m) => [m[1], m[2]]))
    expect(found).toEqual(TER_CATEGORY)
  })
})

describe('PPh 21 properties', () => {
  const engine: Pph21Engine = calculatePph21

  test('TER masa tax rounds to the nearest rupiah (engine rule) for all brackets', () => {
    expectClean(terMonthly(engine, 'nearest'))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH21-TER-MASA-FLOOR: the engine rounds half up; the brief and
  // tax-formulas-mapping.md use floor; the guide (p.63) only shows exact values.
  counterexample('TER masa tax equals floor(bruto x rate)', () => terMonthly(engine, 'floor'))

  test('TER masa tax never falls when bruto rises', () => {
    expectClean(terMonotone(engine))
  })

  test('annual tax = Pasal 17 on PKP floored to thousands', () => {
    expectClean(annualPkp(engine))
  })

  test('annual tax never falls when bruto rises', () => {
    expectClean(annualMonotone(engine))
  })

  test('December = annual - Jan..Nov withheld, with the engine rounding, when not negative', () => {
    expectClean(december(engine, 'nearest'))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH21-DECEMBER-FLOOR: same root cause as the floor test above.
  counterexample('December = annual - Jan..Nov withheld with floor-rounded masa tax', () => december(engine, 'floor'))

  // COUNTEREXAMPLE, see RESULTS.md PPH21-DECEMBER-NEGATIVE: the engine clamps the December adjustment at 0
  // and keeps the excess withheld inside totalTax; the guide (p.66) refunds it.
  counterexample('when Jan..Nov withheld exceeds annual tax, the year total is the annual tax (excess refunded)', () => decemberNegative(engine))

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PARTIAL-YEAR: no Dec reconciliation for fewer than 12 masa, and biaya jabatan capped at 6 jt instead of 500 rb x masa.
  counterexample('pegawai tetap with fewer than 12 masa reconciles to annual tax (p.65-66)', () => partialYear(engine))

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PARTIAL-YEAR (worked example).
  const tuanB = lazy(() =>
    calculatePph21(pphInput({ ptkpStatus: 'TK/0', scheme: 'ter', brutoMonthly: 15_500_000, monthsPaid: 4, pensionContribution: 100_000 })).totalTax,
  )
  test('p.65-66 worked example: the engine returns a number for Tuan B', () => {
    console.info(`[check] PPH21-PARTIAL-YEAR worked example engine=${tuanB()} guide=280000`)
    expect(Number.isFinite(tuanB())).toBe(true)
  })
  // The guide nets 100.000 x 4 iuran pensiun; with it the annual tax is 5% x 5.600.000 = 280.000.
  test.fails('p.65-66 worked example: Tuan B, 4 masa x Rp15.500.000, TK/0, owes Rp280.000 for the year', () => {
    expect(tuanB()).toBe(280_000)
  })

  test('0 <= tax <= bruto for every subject type, zero bruto gives zero tax', () => {
    expectClean(bounds(engine), 80_000)
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH21-NEGATIVE-INPUT: negative bruto produces negative tax for some subject types.
counterexample('negative bruto never yields negative tax', () => {
    const { report, subjects } = nonNegativeOnNegativeInput(engine)
    console.info(`[check] PPH21-NEGATIVE-INPUT subject types with negative tax: ${subjects.join(', ')}`)
    return report
  })

  test('pensiunan, 12 masa: biaya pensiun max Rp2.400.000, Pasal 17 on floored PKP (p.82-85)', () => {
    expectClean(pensiunan12(engine))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PENSIUNAN-PARTIAL: biaya pensiun cap is flat 2,4 jt, the guide caps at 200 rb x masa (p.82).
  counterexample('pensiunan, fewer than 12 masa: biaya pensiun max Rp200.000 x masa', () => pensiunanPartial(engine))

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PENSIUNAN-TER-MASA: `scheme: ter` is ignored for pensiunan.
  counterexample('pensiunan on TER: one masa = bruto x TER Bulanan', () => pensiunanTerMasa(engine))

  test('bukan pegawai: Pasal 17 on 50% of bruto (p.97-98)', () => {
    expectClean(flatPasal17(engine, 'bukan_pegawai', 5000))
  })

  test.each(['peserta_kegiatan', 'program_pensiun', 'mantan_pegawai'] as const)('%s: Pasal 17 on the full bruto (p.33)', (subjectType) => {
    expectClean(flatPasal17(engine, subjectType, 10_000))
  })

  test('wpln: PPh 26 is 20% of bruto (p.110)', () => {
    expectClean(wpln(engine))
  })

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PTT-DAILY-TER: the engine applies A/B/C daily tables; the guide has 0% / 0,5%.
  counterexample('pegawai tidak tetap, daily wage up to Rp2.500.000: 0% to Rp450.000, then 0,5% (p.43)', () => dailyLow(engine))

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PTT-DAILY-PASAL17: above Rp2.500.000 the engine still uses a flat 1,5-2% TER row.
  counterexample('pegawai tidak tetap, daily wage above Rp2.500.000: Pasal 17 x 50% x bruto (p.89, p.92)', () => dailyHigh(engine))

  // COUNTEREXAMPLE, see RESULTS.md PPH21-PTT-MONTHLY: paid monthly, the guide applies TER Bulanan at any amount (p.89, p.93);
  // the engine switches to 50% x Pasal 17 above Rp2.500.000.
  counterexample('pegawai tidak tetap paid monthly: TER Bulanan x bruto bulanan', () => pttMonthly(engine))
})

describe('negative controls: mutants must be rejected', () => {
  async function load(setup: () => void): Promise<Pph21Engine> {
    vi.resetModules()
    setup()
    const mod = await import('./pph21')
    vi.doUnmock('./constants')
    vi.doUnmock('./utils')
    vi.resetModules()
    return mod.calculatePph21
  }

  test('mutant 1: TER A row 6 ceiling moved up by Rp1', async () => {
    const mutant = await load(() =>
      vi.doMock('./constants', async (importOriginal) => {
        const actual = await importOriginal<typeof ConstantsModule>()
        const rows = actual.TER_BULANAN_TABLE.A.map((row) => ({ ...row }))
        rows[5].ceiling += 1
        return { ...actual, TER_BULANAN_TABLE: { ...actual.TER_BULANAN_TABLE, A: rows } }
      }),
    )
    const report = terMonthly(mutant, 'nearest')
    console.info(`[check] MUTANT-PPH21-TER-ROW violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 2: PKP is not floored to thousands', async () => {
    const mutant = await load(() =>
      vi.doMock('./utils', async (importOriginal) => {
        const actual = await importOriginal<typeof UtilsModule>()
        return { ...actual, roundDownToThousand: (value: number) => Math.max(0, value) }
      }),
    )
    const report = annualPkp(mutant)
    console.info(`[check] MUTANT-PPH21-NO-FLOOR violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })

  test('mutant 3: PTKP of K/1 raised by Rp1.000', async () => {
    const mutant = await load(() =>
      vi.doMock('./constants', async (importOriginal) => {
        const actual = await importOriginal<typeof ConstantsModule>()
        return { ...actual, PTKP_TABLE: { ...actual.PTKP_TABLE, 'K/1': actual.PTKP_TABLE['K/1'] + 1000 } }
      }),
    )
    const report = annualPkp(mutant)
    console.info(`[check] MUTANT-PPH21-PTKP violations=${report.violations} first: ${report.first}`)
    expect(report.violations).toBeGreaterThan(0)
  })
})
