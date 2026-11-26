// Property checks. Each runs a generator of cases against an engine function and an oracle, and returns
// a Report. Engines are passed in so that the negative controls can run the same checks on mutants.
import { expect, test } from 'vitest'
import { GRID_SIZE, SEED, STATUSES, brutoGrid, int, mulberry32, rangeGrid, snappedGrid } from './domain'
import {
  HARIAN_PASAL17_THRESHOLD,
  PPH26_BPS,
  PPN_BPS_BY_YEAR,
  TER_CATEGORY,
  annualPegawaiTetap,
  annualPensiunan,
  harianRateBps,
  pasal17,
  rate,
  terRateBps,
} from './oracle'
import type { PPh21Input, PPh21SubjectType } from '../pph21'
import type { PpnInput } from '../ppn'
import type { TaxResult } from '../types'
import type { Rounding } from './oracle'

export interface Report {
  id: string
  cases: number
  violations: number
  first: string | null
}

export type Pph21Engine = (input: PPh21Input) => TaxResult

/** Run `fn` over every case; `fn` returns null when the case holds, else a description of the failure. */
export function run<T>(id: string, cases: Iterable<T>, fn: (c: T) => string | null): Report {
  let n = 0
  let bad = 0
  let first: string | null = null
  for (const c of cases) {
    n++
    const failure = fn(c)
    if (failure !== null) {
      bad++
      first ??= failure
    }
  }
  return { id, cases: n, violations: bad, first }
}

export const ALL_SUBJECTS: ReadonlyArray<PPh21SubjectType> = [
  'pegawai_tetap',
  'pensiunan',
  'pegawai_tidak_tetap',
  'bukan_pegawai',
  'peserta_kegiatan',
  'program_pensiun',
  'mantan_pegawai',
  'wpln',
]

export function pphInput(over: Partial<PPh21Input> & { ptkpStatus: string }): PPh21Input {
  return {
    subjectType: 'pegawai_tetap',
    brutoMonthly: 0,
    monthsPaid: 12,
    pensionContribution: 0,
    zakatOrDonation: 0,
    scheme: 'lama',
    terCategory: TER_CATEGORY[over.ptkpStatus] ?? 'A',
    bonusAnnual: 0,
    foreignTaxRate: 20,
    ...over,
  }
}

type StatusBruto = { status: string; bruto: number }

/** D = 8 statuses x grid values, ascending bruto within each status. */
export function statusCases(values: ReadonlyArray<number>): Array<StatusBruto> {
  return STATUSES.flatMap((status) => values.map((bruto) => ({ status, bruto })))
}

const show = (c: StatusBruto, extra = '') => `${c.status} bruto=${c.bruto}${extra}`

// ---------- PPh 21: TER ----------

/** Pegawai tetap, TER, one masa: tax must equal bruto x TER rate (p.40-42) under the given rounding. */
export function terMonthly(engine: Pph21Engine, rounding: Rounding): Report {
  return run(`PPH21-TER-MASA-${rounding.toUpperCase()}`, statusCases(brutoGrid()), (c) => {
    const got = engine(pphInput({ subjectType: 'pegawai_tetap', ptkpStatus: c.status, scheme: 'ter', monthsPaid: 1, brutoMonthly: c.bruto })).totalTax
    const want = rate(c.bruto, terRateBps(TER_CATEGORY[c.status], c.bruto), rounding)
    return got === want ? null : `${show(c)} engine=${got} oracle=${want}`
  })
}

/** More bruto never lowers the TER masa tax. */
export function terMonotone(engine: Pph21Engine): Report {
  let prevStatus = ''
  let prev = -1
  let prevBruto = 0
  return run('PPH21-TER-MONOTONE', statusCases(brutoGrid()), (c) => {
    const got = engine(pphInput({ subjectType: 'pegawai_tetap', ptkpStatus: c.status, scheme: 'ter', monthsPaid: 1, brutoMonthly: c.bruto })).totalTax
    const failure = c.status === prevStatus && got < prev ? `${show(c)} tax=${got} < tax=${prev} at bruto=${prevBruto}` : null
    prevStatus = c.status
    prev = got
    prevBruto = c.bruto
    return failure
  })
}

// ---------- PPh 21: annual, December ----------

interface Annualised extends StatusBruto {
  bonus: number
  iuran: number
  zakat: number
}

/** Snapped (multiple of 20, so 5% biaya jabatan is exact) cases with seeded bonus, iuran pensiun and zakat. */
function annualCases(zakatHeavy: boolean, seedOffset: number, size = GRID_SIZE): Array<Annualised> {
  const rng = mulberry32(SEED + seedOffset)
  return statusCases(snappedGrid(20, size)).map((c) => {
    const bonus = rng() < 0.5 ? 0 : int(rng, Math.floor(Math.min(c.bruto * 12, 1e12) / 20)) * 20
    const iuran = rng() < 0.5 ? 0 : int(rng, Math.floor(c.bruto * 0.03))
    const zakat = zakatHeavy ? int(rng, Math.floor(c.bruto * 3)) : rng() < 0.5 ? 0 : int(rng, Math.floor(c.bruto * 0.1))
    return { ...c, bonus, iuran, zakat }
  })
}

const annualOf = (c: Annualised, months = 12) =>
  annualPegawaiTetap({ brutoTahun: c.bruto * months + c.bonus, iuranTahun: c.iuran * months, zakat: c.zakat, status: c.status, months })

/** Lama scheme, 12 masa: PPh 21 setahun = Pasal 17 on floor-to-thousand(neto - PTKP) (p.32, p.61, p.64). */
export function annualPkp(engine: Pph21Engine): Report {
  return run('PPH21-ANNUAL-PKP', annualCases(false, 1), (c) => {
    const got = engine(pphInput({ ptkpStatus: c.status, scheme: 'lama', brutoMonthly: c.bruto, bonusAnnual: c.bonus, pensionContribution: c.iuran })).totalTax
    const want = annualPegawaiTetap({ brutoTahun: c.bruto * 12 + c.bonus, iuranTahun: c.iuran * 12, zakat: 0, status: c.status, months: 12 })
    return got === want ? null : `${show(c)} bonus=${c.bonus} iuran=${c.iuran} engine=${got} oracle=${want}`
  })
}

/** Annual tax never decreases when bruto grows (other inputs fixed). */
export function annualMonotone(engine: Pph21Engine): Report {
  let prevStatus = ''
  let prev = -1
  let prevBruto = 0
  return run('PPH21-ANNUAL-MONOTONE', statusCases(snappedGrid(20)), (c) => {
    const got = engine(pphInput({ ptkpStatus: c.status, scheme: 'lama', brutoMonthly: c.bruto })).totalTax
    const failure = c.status === prevStatus && got < prev ? `${show(c)} tax=${got} < tax=${prev} at bruto=${prevBruto}` : null
    prevStatus = c.status
    prev = got
    prevBruto = c.bruto
    return failure
  })
}

/** December amount (the engine's `december_adjustment` row) = annual - Jan..Nov withheld, when that is not negative (p.63-64). */
export function december(engine: Pph21Engine, rounding: Rounding): Report {
  const withheld = (c: Annualised) => 11 * rate(c.bruto, terRateBps(TER_CATEGORY[c.status], c.bruto), rounding)
  const rows = annualCases(false, 2, 1300).filter((c) => annualOf(c) >= withheld(c))
  return run(`PPH21-DECEMBER-${rounding.toUpperCase()}`, rows, (c) => {
    const result = engine(pphInput({ ptkpStatus: c.status, scheme: 'ter', brutoMonthly: c.bruto, bonusAnnual: c.bonus, pensionContribution: c.iuran, zakatOrDonation: c.zakat }))
    const got = result.breakdown.find((r) => r.id === 'december_adjustment')?.value
    const want = annualOf(c) - withheld(c)
    return got === want ? null : `${show(c)} bonus=${c.bonus} iuran=${c.iuran} zakat=${c.zakat} engine December=${String(got)} oracle=${want}`
  })
}

/** When annual tax is below what Jan..Nov already withheld, the guide refunds the excess (p.66 "lebih dipotong"). */
export function decemberNegative(engine: Pph21Engine): Report {
  const rows = annualCases(true, 3, 5200).filter((c) => annualOf(c) < 11 * rate(c.bruto, terRateBps(TER_CATEGORY[c.status], c.bruto), 'nearest'))
  return run('PPH21-DECEMBER-NEGATIVE', rows, (c) => {
    const got = engine(pphInput({ ptkpStatus: c.status, scheme: 'ter', brutoMonthly: c.bruto, bonusAnnual: c.bonus, pensionContribution: c.iuran, zakatOrDonation: c.zakat })).totalTax
    const want = annualOf(c)
    return got === want ? null : `${show(c)} bonus=${c.bonus} iuran=${c.iuran} zakat=${c.zakat} annual=${want} engine totalTax=${got}`
  })
}

/** Pegawai tetap who worked fewer than 12 masa: Dec reconciles to annual tax with biaya jabatan max Rp500.000 x masa (p.65-66). */
export function partialYear(engine: Pph21Engine): Report {
  const rng = mulberry32(SEED + 4)
  const rows = statusCases(snappedGrid(20)).map((c) => ({ ...c, months: 1 + int(rng, 10) }))
  return run('PPH21-PARTIAL-YEAR', rows, (c) => {
    const got = engine(pphInput({ ptkpStatus: c.status, scheme: 'ter', brutoMonthly: c.bruto, monthsPaid: c.months })).totalTax
    const want = annualOf({ ...c, bonus: 0, iuran: 0, zakat: 0 }, c.months)
    return got === want ? null : `${show(c, ` months=${c.months}`)} engine=${got} oracle=${want}`
  })
}

// ---------- PPh 21: bounds, zero, negative ----------

/** 0 <= tax <= bruto for every subject type and scheme; 0 bruto gives 0 tax. */
export function bounds(engine: Pph21Engine): Report {
  const rows = statusCases(brutoGrid()).flatMap((c) =>
    ALL_SUBJECTS.map((subjectType) => ({ ...c, subjectType })),
  )
  return run('PPH21-BOUNDS', rows, (c) => {
    const months = 12
    const scheme = c.bruto % 2 === 0 ? 'ter' : 'lama'
    const total = engine(pphInput({ subjectType: c.subjectType, ptkpStatus: c.status, scheme, brutoMonthly: c.bruto, monthsPaid: months })).totalTax
    const limit = c.bruto * months
    if (total < 0 || total > limit) return `${c.subjectType} ${show(c)} ${scheme} tax=${total} outside [0, ${limit}]`
    if (c.bruto === 0 && total !== 0) return `${c.subjectType} ${show(c)} zero bruto taxed ${total}`
    return null
  })
}

/** Negative inputs must not produce negative tax. Reports the subject types that do. */
export function nonNegativeOnNegativeInput(engine: Pph21Engine): { report: Report; subjects: Array<string> } {
  const subjects = new Set<string>()
  const rows = statusCases(brutoGrid().map((v) => -v)).flatMap((c) => ALL_SUBJECTS.map((subjectType) => ({ ...c, subjectType })))
  const report = run('PPH21-NEGATIVE-INPUT', rows, (c) => {
    const total = engine(pphInput({ subjectType: c.subjectType, ptkpStatus: c.status, scheme: 'ter', brutoMonthly: c.bruto, monthsPaid: 3, isDailyWorker: c.bruto % 2 === 0 })).totalTax
    if (total >= 0) return null
    subjects.add(`${c.subjectType}${c.bruto % 2 === 0 && c.subjectType === 'pegawai_tidak_tetap' ? ' (daily)' : ''}`)
    return `${c.subjectType} ${show(c)} tax=${total}`
  })
  return { report, subjects: [...subjects].sort() }
}

// ---------- PPh 21: other subject types ----------

export function pensiunan12(engine: Pph21Engine): Report {
  return run('PPH21-PENSIUNAN-12', annualCases(false, 5), (c) => {
    const got = engine(pphInput({ subjectType: 'pensiunan', ptkpStatus: c.status, brutoMonthly: c.bruto, bonusAnnual: c.bonus })).totalTax
    const want = annualPensiunan({ brutoTahun: c.bruto * 12 + c.bonus, iuranTahun: 0, zakat: 0, status: c.status, months: 12 })
    return got === want ? null : `${show(c)} bonus=${c.bonus} engine=${got} oracle=${want}`
  })
}

/** Pensiunan paid in TER: each masa is bruto x TER (p.82-85). The engine ignores `scheme` for pensiunan. */
export function pensiunanTerMasa(engine: Pph21Engine): Report {
  return run('PPH21-PENSIUNAN-TER-MASA', statusCases(brutoGrid()), (c) => {
    const got = engine(pphInput({ subjectType: 'pensiunan', ptkpStatus: c.status, scheme: 'ter', monthsPaid: 1, brutoMonthly: c.bruto })).totalTax
    const want = rate(c.bruto, terRateBps(TER_CATEGORY[c.status], c.bruto), 'nearest')
    return got === want ? null : `${show(c)} engine=${got} oracle=${want}`
  })
}

export function pensiunanPartial(engine: Pph21Engine): Report {
  const rng = mulberry32(SEED + 6)
  const rows = statusCases(snappedGrid(20)).map((c) => ({ ...c, months: 1 + int(rng, 10) }))
  return run('PPH21-PENSIUNAN-PARTIAL', rows, (c) => {
    const got = engine(pphInput({ subjectType: 'pensiunan', ptkpStatus: c.status, monthsPaid: c.months, brutoMonthly: c.bruto })).totalTax
    const want = annualPensiunan({ brutoTahun: c.bruto * c.months, iuranTahun: 0, zakat: 0, status: c.status, months: c.months })
    return got === want ? null : `${show(c, ` months=${c.months}`)} engine=${got} oracle=${want}`
  })
}

/** Subject types taxed with Pasal 17 on a flat base (p.33): bukan pegawai 50% of bruto, the rest 100%. */
export function flatPasal17(engine: Pph21Engine, subjectType: PPh21SubjectType, shareBps: number): Report {
  const rng = mulberry32(SEED + 7)
  const rows = statusCases(snappedGrid(40)).map((c) => ({ ...c, months: 1 + int(rng, 11), bonus: rng() < 0.5 ? 0 : int(rng, 1e9 / 40) * 40 }))
  return run(`PPH21-${subjectType.toUpperCase()}`, rows, (c) => {
    const got = engine(pphInput({ subjectType, ptkpStatus: c.status, brutoMonthly: c.bruto, monthsPaid: c.months, bonusAnnual: c.bonus })).totalTax
    const want = pasal17(rate(c.bruto * c.months + c.bonus, shareBps, 'nearest'))
    return got === want ? null : `${show(c, ` months=${c.months} bonus=${c.bonus}`)} engine=${got} oracle=${want}`
  })
}

/** PPh 26: 20% of bruto (p.110). */
export function wpln(engine: Pph21Engine): Report {
  const rng = mulberry32(SEED + 8)
  const rows = statusCases(brutoGrid()).map((c) => ({ ...c, months: 1 + int(rng, 11) }))
  return run('PPH21-WPLN', rows, (c) => {
    const got = engine(pphInput({ subjectType: 'wpln', ptkpStatus: c.status, brutoMonthly: c.bruto, monthsPaid: c.months })).totalTax
    const want = rate(c.bruto * c.months, PPH26_BPS, 'nearest')
    return got === want ? null : `${show(c, ` months=${c.months}`)} engine=${got} oracle=${want}`
  })
}

/** Pegawai tidak tetap, daily wage at or below Rp2.500.000 (p.43, p.89): 0% to Rp450.000, then 0,5%. */
export function dailyLow(engine: Pph21Engine): Report {
  const edges = [0, 1, 449_999, 450_000, 450_001, 2_499_999, HARIAN_PASAL17_THRESHOLD]
  return run('PPH21-PTT-DAILY-TER', statusCases(rangeGrid(0, HARIAN_PASAL17_THRESHOLD, edges, 1, SEED + 9)), (c) => {
    const got = engine(pphInput({ subjectType: 'pegawai_tidak_tetap', ptkpStatus: c.status, isDailyWorker: true, brutoMonthly: c.bruto, monthsPaid: 1 })).totalTax
    const want = rate(c.bruto, harianRateBps(c.bruto), 'nearest')
    return got === want ? null : `${show(c)} engine=${got} oracle=${want}`
  })
}

/** Daily wage above Rp2.500.000: Pasal 17 rate x 50% x bruto (p.89, example p.92: Rp3.000.000 gives Rp75.000). */
export function dailyHigh(engine: Pph21Engine): Report {
  const edges = [2_500_040, 3_000_000, 1_000_000_000_000]
  return run('PPH21-PTT-DAILY-PASAL17', statusCases(rangeGrid(HARIAN_PASAL17_THRESHOLD + 40, 1_000_000_000_000, edges, 40, SEED + 10)), (c) => {
    const got = engine(pphInput({ subjectType: 'pegawai_tidak_tetap', ptkpStatus: c.status, isDailyWorker: true, brutoMonthly: c.bruto, monthsPaid: 1 })).totalTax
    const want = pasal17(rate(c.bruto, 5000, 'nearest'))
    return got === want ? null : `${show(c)} engine=${got} oracle=${want}`
  })
}

/** Pegawai tidak tetap paid monthly: TER Bulanan x bruto bulanan (p.89, example p.93). */
export function pttMonthly(engine: Pph21Engine): Report {
  return run('PPH21-PTT-MONTHLY', statusCases(brutoGrid()), (c) => {
    const got = engine(pphInput({ subjectType: 'pegawai_tidak_tetap', ptkpStatus: c.status, scheme: 'ter', monthsPaid: 1, brutoMonthly: c.bruto })).totalTax
    const want = rate(c.bruto, terRateBps(TER_CATEGORY[c.status], c.bruto), 'nearest')
    return got === want ? null : `${show(c)} engine=${got} oracle=${want}`
  })
}

// ---------- PPN ----------

export type PpnEngine = (input: PpnInput) => TaxResult

interface PpnCase {
  year: string
  includePpn: boolean
  base: number
  discount: number
  other: number
  gross: number
}

export const PPN_UI_YEARS = ['2022', '2023', '2024', '2025'] as const

export function ppnCases(years: ReadonlyArray<string>, size = 1250, seedOffset = 0): Array<PpnCase> {
  const rng = mulberry32(SEED + 100 + seedOffset)
  const out: Array<PpnCase> = []
  for (const year of years) {
    for (const includePpn of [false, true]) {
      for (const base of brutoGrid(size)) {
        const discount = rng() < 0.5 ? 0 : int(rng, Math.floor(base * 0.2))
        const other = rng() < 0.5 ? 0 : int(rng, Math.floor(base * 0.1))
        out.push({ year, includePpn, base, discount, other, gross: Math.max(0, base - discount + other) })
      }
    }
  }
  return out
}

const ppnIn = (c: PpnCase, over: Partial<PpnInput> = {}): PpnInput => ({
  taxYear: c.year,
  basePrice: c.base,
  discount: c.discount,
  otherCosts: c.other,
  includePpn: c.includePpn,
  ...over,
})

const showPpn = (c: PpnCase) => `year=${c.year} incl=${c.includePpn} base=${c.base} discount=${c.discount} other=${c.other}`

/** dpp as the oracle sees it: exclusive dpp = gross; inclusive dpp = round(gross / (1 + rate)). */
function ppnOracle(c: PpnCase, bps: number): { dpp: number; ppn: number } {
  if (!c.includePpn) return { dpp: c.gross, ppn: rate(c.gross, bps, 'nearest') }
  const dpp = Number((BigInt(c.gross) * 10_000n + BigInt(bps + 10_000) / 2n) / BigInt(bps + 10_000))
  return { dpp, ppn: c.gross - dpp }
}

/** PPN and DPP match the oracle at the statutory rate for `years`. */
export function ppnRate(engine: PpnEngine, years: ReadonlyArray<string>, id: string): Report {
  return run(id, ppnCases(years, Math.floor(5000 / years.length)), (c) => {
    const want = ppnOracle(c, PPN_BPS_BY_YEAR[c.year])
    const got = engine(ppnIn(c)).totalTax
    return got === want.ppn ? null : `${showPpn(c)} engine ppn=${got} oracle ppn=${want.ppn} (rate ${PPN_BPS_BY_YEAR[c.year] / 100}%)`
  })
}

/** DPP + PPN = total billed; inclusive: total = the price entered (design.md section 10). */
export function ppnSum(engine: PpnEngine): Report {
  return run('PPN-DPP-PLUS-PPN-IS-TOTAL', ppnCases(PPN_UI_YEARS, 1250, 1), (c) => {
    const result = engine(ppnIn(c))
    const dpp = result.breakdown.find((r) => r.variant === 'subtotal')?.value
    const total = result.breakdown.find((r) => r.variant === 'total')?.value
    if (typeof dpp !== 'number' || typeof total !== 'number') return `${showPpn(c)} breakdown rows missing`
    if (dpp + result.totalTax !== total) return `${showPpn(c)} dpp=${dpp} + ppn=${result.totalTax} != total=${total}`
    if (c.includePpn && total !== c.gross) return `${showPpn(c)} inclusive total=${total} != entered price ${c.gross}`
    if (!c.includePpn && dpp !== c.gross) return `${showPpn(c)} exclusive dpp=${dpp} != ${c.gross}`
    return null
  })
}

/** Exclusive then inclusive: price a DPP, add PPN, feed the total back as an inclusive price; DPP returns within Rp1. */
export function ppnRoundTrip(engine: PpnEngine): Report {
  const base = ppnCases(PPN_UI_YEARS, 1250, 2).filter((c) => !c.includePpn)
  const rows = [...base, ...ppnCases(PPN_UI_YEARS, 1250, 3).filter((c) => c.includePpn)].slice(0, 10_000)
  return run('PPN-ROUND-TRIP', rows, (c) => {
    const excl = engine({ ...ppnIn(c), includePpn: false })
    const total = c.gross + excl.totalTax
    const back = engine({ taxYear: c.year, basePrice: total, discount: 0, otherCosts: 0, includePpn: true })
    const dppBack = total - back.totalTax
    return Math.abs(dppBack - c.gross) <= 1 ? null : `${showPpn(c)} dpp=${c.gross} total=${total} dpp back=${dppBack}`
  })
}

/** Zero and negative inputs: nothing is owed on a non-positive base. */
export function ppnNonPositive(engine: PpnEngine): Report {
  const rng = mulberry32(SEED + 200)
  const rows = Array.from({ length: 10_000 }, (_, i) => {
    const base = -int(rng, 10 ** int(rng, 12))
    return { year: PPN_UI_YEARS[i % 4], includePpn: i % 2 === 0, base, discount: int(rng, 1000), other: -int(rng, 1000), gross: 0 } as PpnCase
  })
  return run('PPN-NON-POSITIVE', rows, (c) => {
    const result = engine(ppnIn(c))
    return result.totalTax === 0 ? null : `${showPpn(c)} ppn=${result.totalTax}`
  })
}

/** customRate is a percent: 5,5 means 5,5%. */
export function ppnCustomRate(engine: PpnEngine): Report {
  const rng = mulberry32(SEED + 300)
  const rows = ppnCases(['2024'], 1250, 4).concat(ppnCases(['2025'], 1250, 5)).slice(0, 2500)
  const more = Array.from({ length: 10_000 }, (_, i) => ({ ...rows[i % rows.length], pct: 1 + int(rng, 3000) / 100 }))
  return run('PPN-CUSTOM-RATE', more, (c) => {
    const bps = Math.round(c.pct * 100)
    const want = ppnOracle(c, bps)
    const got = engine(ppnIn(c, { customRate: c.pct })).totalTax
    return got === want.ppn ? null : `${showPpn(c)} customRate=${c.pct} engine=${got} oracle=${want.ppn}`
  })
}

// ---------- PPnBM, PPh 22, PPh 23, PPh 4(2): rate x base, plus clamps ----------

/** Result must equal base x rateBps rounded to the nearest rupiah, in exact integers. */
export function flatRate(
  id: string,
  runEngine: (key: string, base: number) => number,
  keys: ReadonlyArray<{ key: string; bps: number }>,
): Report {
  const rows = keys.flatMap((k) => brutoGrid(Math.ceil(10_000 / keys.length)).map((base) => ({ ...k, base })))
  return run(id, rows, (c) => {
    const got = runEngine(c.key, c.base)
    const want = rate(c.base, c.bps, 'nearest')
    return got === want ? null : `${c.key} base=${c.base} engine=${got} oracle=${want} (rate ${c.bps / 100}%)`
  })
}

/** Non-positive base: no tax, and certainly not a refund. */
export function nonPositiveBase(id: string, runEngine: (key: string, base: number) => number, keys: ReadonlyArray<string>): Report {
  const rows = keys.flatMap((key) => brutoGrid(Math.ceil(10_000 / keys.length)).map((v) => ({ key, base: -v })))
  return run(id, rows, (c) => {
    const got = runEngine(c.key, c.base)
    return got === 0 ? null : `${c.key} base=${c.base} tax=${got}`
  })
}

/** Log a report and assert it is clean with at least `minCases` cases. Counterexample tests wrap this in test.fails. */
export function expectClean(report: Report, minCases = 10_000): void {
  console.info(`[check] ${report.id} cases=${report.cases} violations=${report.violations}${report.first ? ` first: ${report.first}` : ''}`)
  expect(report.cases).toBeGreaterThanOrEqual(minCases)
  expect(report.violations, report.first ?? '').toBe(0)
}

/** Run `make` once, however many tests ask for its report. */
export function lazy<T>(make: () => T): () => T {
  let made: { value: T } | undefined
  return () => (made ??= { value: make() }).value
}

/**
 * A known counterexample as two tests. The ordinary test generates the domain, runs the engine and asserts the
 * case count, so a vacuous or broken run is red. Only the second test is test.fails, and it asserts nothing but
 * "no tax violation" on the report the first test already validated.
 */
export function counterexample(title: string, make: () => Report, minCases = 10_000): void {
  const get = lazy(make)
  test(`${title} [domain >= ${minCases} cases]`, () => {
    const report = get()
    console.info(`[check] ${report.id} cases=${report.cases} violations=${report.violations}${report.first ? ` first: ${report.first}` : ''}`)
    expect(report.cases).toBeGreaterThanOrEqual(minCases)
  })
  test.fails(title, () => {
    const report = get()
    expect(report.violations, report.first ?? '').toBe(0)
  })
}
