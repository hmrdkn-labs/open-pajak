// Independent oracle for the tax engines. Every table below is transcribed from the official
// guide, NOT from ../constants.ts. Source: Buku_PPh2126_Release_20240108.pdf (DJP/Kemenkeu,
// "Buku Panduan PPh Pasal 21/26", 115 pages; PDF page = printed page number). Rates are integers in
// basis points (1% = 100, 0.25% = 25). Amounts are whole rupiah.
// Where the PDF is silent (see RESULTS.md) the rule is marked [SILENT] and is not treated as source.

export type Ter = 'A' | 'B' | 'C'
export type Row = readonly [ceiling: number, bps: number]

// Tabel 7.2 and 7.3, PDF p.48 (PMK 101/PMK.010/2016, Tabel 7.1 p.47).
export const PTKP: Readonly<Record<string, number>> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
}

// Tabel 7.4, PDF p.48: suami-istri digabung. The engine has no such status.
export const PTKP_KI: Readonly<Record<string, number>> = {
  'K/I/0': 112_500_000,
  'K/I/1': 117_000_000,
  'K/I/2': 121_500_000,
  'K/I/3': 126_000_000,
}

// PDF p.40 (A), p.41 (B), p.42 (C): which PTKP status uses which TER category.
export const TER_CATEGORY: Readonly<Record<string, Ter>> = {
  'TK/0': 'A',
  'TK/1': 'A',
  'K/0': 'A',
  'TK/2': 'B',
  'TK/3': 'B',
  'K/1': 'B',
  'K/2': 'B',
  'K/3': 'C',
}

// Tabel 6.1, PDF p.39: Pasal 17 ayat (1) huruf a UU PPh. Cumulative upper bound and rate (bps).
export const PASAL17: ReadonlyArray<Row> = [
  [60_000_000, 500],
  [250_000_000, 1500],
  [500_000_000, 2500],
  [5_000_000_000, 3000],
  [Infinity, 3500],
]

export const TER_BULANAN: Readonly<Record<Ter, ReadonlyArray<Row>>> = {
  // Tabel 6.2 Tarif Efektif Bulanan Kategori A, PDF p.40
  A: [
    [5_400_000, 0], [5_650_000, 25], [5_950_000, 50], [6_300_000, 75],
    [6_750_000, 100], [7_500_000, 125], [8_550_000, 150], [9_650_000, 175],
    [10_050_000, 200], [10_350_000, 225], [10_700_000, 250], [11_050_000, 300],
    [11_600_000, 350], [12_500_000, 400], [13_750_000, 500], [15_100_000, 600],
    [16_950_000, 700], [19_750_000, 800], [24_150_000, 900], [26_450_000, 1000],
    [28_000_000, 1100], [30_050_000, 1200], [32_400_000, 1300], [35_400_000, 1400],
    [39_100_000, 1500], [43_850_000, 1600], [47_800_000, 1700], [51_400_000, 1800],
    [56_300_000, 1900], [62_200_000, 2000], [68_600_000, 2100], [77_500_000, 2200],
    [89_000_000, 2300], [103_000_000, 2400], [125_000_000, 2500], [157_000_000, 2600],
    [206_000_000, 2700], [337_000_000, 2800], [454_000_000, 2900], [550_000_000, 3000],
    [695_000_000, 3100], [910_000_000, 3200], [1_400_000_000, 3300], [Infinity, 3400],
  ],
  // Tabel 6.3 Tarif Efektif Bulanan Kategori B, PDF p.41
  B: [
    [6_200_000, 0], [6_500_000, 25], [6_850_000, 50], [7_300_000, 75],
    [9_200_000, 100], [10_750_000, 150], [11_250_000, 200], [11_600_000, 250],
    [12_600_000, 300], [13_600_000, 400], [14_950_000, 500], [16_400_000, 600],
    [18_450_000, 700], [21_850_000, 800], [26_000_000, 900], [27_700_000, 1000],
    [29_350_000, 1100], [31_450_000, 1200], [33_950_000, 1300], [37_100_000, 1400],
    [41_100_000, 1500], [45_800_000, 1600], [49_500_000, 1700], [53_800_000, 1800],
    [58_500_000, 1900], [64_000_000, 2000], [71_000_000, 2100], [80_000_000, 2200],
    [93_000_000, 2300], [109_000_000, 2400], [129_000_000, 2500], [163_000_000, 2600],
    [211_000_000, 2700], [374_000_000, 2800], [459_000_000, 2900], [555_000_000, 3000],
    [704_000_000, 3100], [957_000_000, 3200], [1_405_000_000, 3300], [Infinity, 3400],
  ],
  // Tabel 6.4 Tarif Efektif Bulanan Kategori C, PDF p.42
  C: [
    [6_600_000, 0], [6_950_000, 25], [7_350_000, 50], [7_800_000, 75],
    [8_850_000, 100], [9_800_000, 125], [10_950_000, 150], [11_200_000, 175],
    [12_050_000, 200], [12_950_000, 300], [14_150_000, 400], [15_550_000, 500],
    [17_050_000, 600], [19_500_000, 700], [22_700_000, 800], [26_600_000, 900],
    [28_100_000, 1000], [30_100_000, 1100], [32_600_000, 1200], [35_400_000, 1300],
    [38_900_000, 1400], [43_000_000, 1500], [47_400_000, 1600], [51_200_000, 1700],
    [55_800_000, 1800], [60_400_000, 1900], [66_700_000, 2000], [74_500_000, 2100],
    [83_200_000, 2200], [95_600_000, 2300], [110_000_000, 2400], [134_000_000, 2500],
    [169_000_000, 2600], [221_000_000, 2700], [390_000_000, 2800], [463_000_000, 2900],
    [561_000_000, 3000], [709_000_000, 3100], [965_000_000, 3200], [1_419_000_000, 3300],
    [Infinity, 3400],
  ],
}

// Tabel TER Harian, PDF p.43 (no A/B/C split): up to Rp450.000 0%, above that up to Rp2.500.000 0,5%.
// Above Rp2.500.000 a day: Pasal 17 rate x 50% x bruto (PDF p.89, examples p.92).
export const TER_HARIAN: ReadonlyArray<Row> = [
  [450_000, 0],
  [2_500_000, 50],
]
export const HARIAN_PASAL17_THRESHOLD = 2_500_000

export const BIAYA_JABATAN_PER_MONTH = 500_000 // PDF p.60: 5%, max Rp6.000.000 a year or Rp500.000 a month
export const BIAYA_PENSIUN_PER_MONTH = 200_000 // PDF p.82: 5%, max Rp2.400.000 a year or Rp200.000 a month
export const PPH26_BPS = 2000 // PDF p.110: 20% of bruto, or per P3B

// PMK 168/2023 TER Harian as proposed by PR #17 (hmrdkn-labs/open-pajak, ghozali25), copied from its diff.
export const PR17_TER_HARIAN: ReadonlyArray<Row> = [
  [450_000, 0],
  [2_500_000, 50],
]

// ---- functions ----

export function terRateBps(category: Ter, bruto: number): number {
  const rows = TER_BULANAN[category]
  for (const [ceiling, bps] of rows) if (bruto <= ceiling) return bps
  throw new Error('unreachable: last TER row is open ended')
}

export function harianRateBps(bruto: number): number {
  for (const [ceiling, bps] of TER_HARIAN) if (bruto <= ceiling) return bps
  throw new Error('harian rate is only defined up to the threshold')
}

export type Rounding = 'floor' | 'nearest'

/** bruto x bps / 10_000 in exact integer arithmetic. */
export function rate(bruto: number, bps: number, rounding: Rounding): number {
  const numerator = BigInt(bruto) * BigInt(bps)
  return Number(rounding === 'floor' ? numerator / 10_000n : (numerator + 5_000n) / 10_000n)
}

/** Pasal 17 tax on a whole-rupiah base. Callers pass bases whose layers divide exactly. */
export function pasal17(base: number): number {
  let lower = 0
  let tax = 0n
  for (const [upper, bps] of PASAL17) {
    if (base <= lower) break
    const taxable = Math.min(base, upper) - lower
    tax += BigInt(taxable) * BigInt(bps)
    lower = upper
  }
  return Number(tax / 10_000n)
}

/** PKP: neto less PTKP, floored to whole thousands (PDF p.32), never negative. */
export function pkp(neto: number, ptkp: number): number {
  return Math.max(0, Math.floor((neto - ptkp) / 1000) * 1000)
}

export function biayaJabatan(brutoTahun: number, months: number): number {
  return Math.min(brutoTahun / 20, BIAYA_JABATAN_PER_MONTH * months)
}

export function biayaPensiun(brutoTahun: number, months: number): number {
  return Math.min(brutoTahun / 20, BIAYA_PENSIUN_PER_MONTH * months)
}

export interface Annual {
  brutoTahun: number
  iuranTahun: number
  zakat: number
  status: string
  months: number
}

/** PPh 21 setahun for a pegawai tetap (PDF p.61, worked examples p.64-66). brutoTahun must be a multiple of 20. */
export function annualPegawaiTetap(a: Annual): number {
  const neto = a.brutoTahun - biayaJabatan(a.brutoTahun, a.months) - a.iuranTahun - a.zakat
  return pasal17(pkp(neto, PTKP[a.status]))
}

/** PPh 21 setahun for a pensiunan (PDF p.82, worked example p.85). */
export function annualPensiunan(a: Annual): number {
  const neto = a.brutoTahun - biayaPensiun(a.brutoTahun, a.months) - a.zakat
  return pasal17(pkp(neto, PTKP[a.status]))
}

// ---- PPN / PPnBM / PPh 22 / 23 / 4(2): rates from regulations, not from the PDF ----
// [INFERENCE] Article numbers below are from the checker's knowledge of the regulations; the repo's
// own docs (design.md, tax-formulas-mapping.md) carry no rate values. Dika signs off on each row.

/** UU 7/2021 (HPP) amending Pasal 7 UU PPN: 11% from 1 Apr 2022, 12% from 1 Jan 2025. Whole-year view. */
export const PPN_BPS_BY_YEAR: Readonly<Record<string, number>> = {
  '2022': 1100, // 1 Jan-31 Mar 2022 was still 10%; a year-granular engine cannot represent that
  '2023': 1100,
  '2024': 1100,
  '2025': 1200,
  '2026': 1200, // statutory rate. PMK 131/2024 "DPP nilai lain" 11/12 is an OPEN QUESTION, not decided here
}

export type Confidence = 'confirmed' | 'dika-to-confirm'

/** PPh 22 (PMK 34/PMK.010/2017 and later): only rows with a single flat rate can be checked. */
export const PPH22_ORACLE: Readonly<Record<string, { bps: number; confidence: Confidence; note: string }>> = {
  impor: { bps: 250, confidence: 'confirmed', note: '2,5% for importers with API; 7,5% without API is not modelled' },
  bumn: { bps: 150, confidence: 'confirmed', note: '1,5% of purchase price, treasurer/BUMN purchases' },
}
/** PPh 22 rows the checker cannot pin to one flat rate. */
export const PPH22_UNVERIFIED = ['migas', 'lainnya'] as const

/** PPh 23 (UU PPh Pasal 23, PMK 141/PMK.03/2015). */
export const PPH23_ORACLE: Readonly<Record<string, { bps: number; confidence: Confidence; note: string }>> = {
  jasaTeknik: { bps: 200, confidence: 'confirmed', note: '2% jasa teknik' },
  jasaKonsultan: { bps: 200, confidence: 'dika-to-confirm', note: '2% jasa konsultan; engine has 4%' },
  sewaAlat: { bps: 200, confidence: 'confirmed', note: '2% sewa dan penghasilan lain sehubungan penggunaan harta' },
  dividen: { bps: 1500, confidence: 'confirmed', note: '15% (UU PPh Pasal 23 ayat 1 huruf a)' },
  bunga: { bps: 1500, confidence: 'confirmed', note: '15% (UU PPh Pasal 23 ayat 1 huruf a)' },
}

/** PPh Final 4(2). */
export const PPH4_2_ORACLE: Readonly<Record<string, { bps: number; confidence: Confidence; note: string }>> = {
  sewaTanah: { bps: 1000, confidence: 'confirmed', note: '10% sewa tanah/bangunan (PP 34/2016)' },
  umkmFinal: { bps: 50, confidence: 'confirmed', note: '0,5% omzet UMKM (PP 55/2022); the Rp500 juta threshold is not modelled' },
}
/** Depends on a class (konstruksi) or is not PPh 4(2) at all (restoran). Reported, not asserted. */
export const PPH4_2_UNVERIFIED = ['konstruksi', 'restoran'] as const
