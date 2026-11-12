export const PTKP_TABLE: Record<string, number> = {
  'TK/0': 54000000,
  'TK/1': 58500000,
  'TK/2': 63000000,
  'TK/3': 67500000,
  'K/0': 58500000,
  'K/1': 63000000,
  'K/2': 67500000,
  'K/3': 72000000,
} as const

export const RATE_SCALE = 10000
const toBps = (rate: number) => Math.round(rate * RATE_SCALE)

export const PASAL17_LAYERS: Array<{ limit: number; rateBps: number }> = [
  { limit: 60000000, rateBps: toBps(0.05) },
  { limit: 190000000, rateBps: toBps(0.15) }, // up to 250 jt kumulatif
  { limit: 250000000, rateBps: toBps(0.25) }, // up to 500 jt kumulatif
  { limit: 4500000000, rateBps: toBps(0.3) }, // up to 5 Milyar kumulatif
  { limit: Number.POSITIVE_INFINITY, rateBps: toBps(0.35) },
] as const

export const TER_BULANAN_TABLE: Record<
  string,
  Array<{ ceiling: number; rateBps: number }>
> = {
  A: [
    { ceiling: 5_400_000, rateBps: toBps(0) },
    { ceiling: 5_650_000, rateBps: toBps(0.0025) },
    { ceiling: 5_950_000, rateBps: toBps(0.005) },
    { ceiling: 6_300_000, rateBps: toBps(0.0075) },
    { ceiling: 6_750_000, rateBps: toBps(0.01) },
    { ceiling: 7_500_000, rateBps: toBps(0.0125) },
    { ceiling: 8_550_000, rateBps: toBps(0.015) },
    { ceiling: 9_650_000, rateBps: toBps(0.0175) },
    { ceiling: 10_050_000, rateBps: toBps(0.02) },
    { ceiling: 10_350_000, rateBps: toBps(0.0225) },
    { ceiling: 10_700_000, rateBps: toBps(0.025) },
    { ceiling: 11_050_000, rateBps: toBps(0.03) },
    { ceiling: 11_600_000, rateBps: toBps(0.035) },
    { ceiling: 12_500_000, rateBps: toBps(0.04) },
    { ceiling: 13_750_000, rateBps: toBps(0.05) },
    { ceiling: 15_100_000, rateBps: toBps(0.06) },
    { ceiling: 16_950_000, rateBps: toBps(0.07) },
    { ceiling: 19_750_000, rateBps: toBps(0.08) },
    { ceiling: 24_150_000, rateBps: toBps(0.09) },
    { ceiling: 26_450_000, rateBps: toBps(0.1) },
    { ceiling: 28_000_000, rateBps: toBps(0.11) },
    { ceiling: 30_050_000, rateBps: toBps(0.12) },
    { ceiling: 32_400_000, rateBps: toBps(0.13) },
    { ceiling: 35_400_000, rateBps: toBps(0.14) },
    { ceiling: 39_100_000, rateBps: toBps(0.15) },
    { ceiling: 43_850_000, rateBps: toBps(0.16) },
    { ceiling: 47_800_000, rateBps: toBps(0.17) },
    { ceiling: 51_400_000, rateBps: toBps(0.18) },
    { ceiling: 56_300_000, rateBps: toBps(0.19) },
    { ceiling: 62_200_000, rateBps: toBps(0.2) },
    { ceiling: 68_600_000, rateBps: toBps(0.21) },
    { ceiling: 77_500_000, rateBps: toBps(0.22) },
    { ceiling: 89_000_000, rateBps: toBps(0.23) },
    { ceiling: 103_000_000, rateBps: toBps(0.24) },
    { ceiling: 125_000_000, rateBps: toBps(0.25) },
    { ceiling: 157_000_000, rateBps: toBps(0.26) },
    { ceiling: 206_000_000, rateBps: toBps(0.27) },
    { ceiling: 337_000_000, rateBps: toBps(0.28) },
    { ceiling: 454_000_000, rateBps: toBps(0.29) },
    { ceiling: 550_000_000, rateBps: toBps(0.3) },
    { ceiling: 695_000_000, rateBps: toBps(0.31) },
    { ceiling: 910_000_000, rateBps: toBps(0.32) },
    { ceiling: 1_400_000_000, rateBps: toBps(0.33) },
    { ceiling: Number.POSITIVE_INFINITY, rateBps: toBps(0.34) },
  ],
  B: [
    { ceiling: 6_200_000, rateBps: toBps(0) },
    { ceiling: 6_500_000, rateBps: toBps(0.0025) },
    { ceiling: 6_850_000, rateBps: toBps(0.005) },
    { ceiling: 7_300_000, rateBps: toBps(0.0075) },
    { ceiling: 9_200_000, rateBps: toBps(0.01) },
    { ceiling: 10_750_000, rateBps: toBps(0.015) },
    { ceiling: 11_250_000, rateBps: toBps(0.02) },
    { ceiling: 11_600_000, rateBps: toBps(0.025) },
    { ceiling: 12_600_000, rateBps: toBps(0.03) },
    { ceiling: 13_600_000, rateBps: toBps(0.04) },
    { ceiling: 14_950_000, rateBps: toBps(0.05) },
    { ceiling: 16_400_000, rateBps: toBps(0.06) },
    { ceiling: 18_450_000, rateBps: toBps(0.07) },
    { ceiling: 21_850_000, rateBps: toBps(0.08) },
    { ceiling: 26_000_000, rateBps: toBps(0.09) },
    { ceiling: 27_700_000, rateBps: toBps(0.1) },
    { ceiling: 29_350_000, rateBps: toBps(0.11) },
    { ceiling: 31_450_000, rateBps: toBps(0.12) },
    { ceiling: 33_950_000, rateBps: toBps(0.13) },
    { ceiling: 37_100_000, rateBps: toBps(0.14) },
    { ceiling: 41_100_000, rateBps: toBps(0.15) },
    { ceiling: 45_800_000, rateBps: toBps(0.16) },
    { ceiling: 49_500_000, rateBps: toBps(0.17) },
    { ceiling: 53_800_000, rateBps: toBps(0.18) },
    { ceiling: 58_500_000, rateBps: toBps(0.19) },
    { ceiling: 64_000_000, rateBps: toBps(0.2) },
    { ceiling: 71_000_000, rateBps: toBps(0.21) },
    { ceiling: 80_000_000, rateBps: toBps(0.22) },
    { ceiling: 93_000_000, rateBps: toBps(0.23) },
    { ceiling: 109_000_000, rateBps: toBps(0.24) },
    { ceiling: 129_000_000, rateBps: toBps(0.25) },
    { ceiling: 163_000_000, rateBps: toBps(0.26) },
    { ceiling: 211_000_000, rateBps: toBps(0.27) },
    { ceiling: 374_000_000, rateBps: toBps(0.28) },
    { ceiling: 459_000_000, rateBps: toBps(0.29) },
    { ceiling: 555_000_000, rateBps: toBps(0.3) },
    { ceiling: 704_000_000, rateBps: toBps(0.31) },
    { ceiling: 957_000_000, rateBps: toBps(0.32) },
    { ceiling: 1_405_000_000, rateBps: toBps(0.33) },
    { ceiling: Number.POSITIVE_INFINITY, rateBps: toBps(0.34) },
  ],
  C: [
    { ceiling: 6_600_000, rateBps: toBps(0) },
    { ceiling: 6_950_000, rateBps: toBps(0.0025) },
    { ceiling: 7_350_000, rateBps: toBps(0.005) },
    { ceiling: 7_800_000, rateBps: toBps(0.0075) },
    { ceiling: 8_850_000, rateBps: toBps(0.01) },
    { ceiling: 9_800_000, rateBps: toBps(0.0125) },
    { ceiling: 10_950_000, rateBps: toBps(0.015) },
    { ceiling: 11_200_000, rateBps: toBps(0.0175) },
    { ceiling: 12_050_000, rateBps: toBps(0.02) },
    { ceiling: 12_950_000, rateBps: toBps(0.03) },
    { ceiling: 14_150_000, rateBps: toBps(0.04) },
    { ceiling: 15_550_000, rateBps: toBps(0.05) },
    { ceiling: 17_050_000, rateBps: toBps(0.06) },
    { ceiling: 19_500_000, rateBps: toBps(0.07) },
    { ceiling: 22_700_000, rateBps: toBps(0.08) },
    { ceiling: 26_600_000, rateBps: toBps(0.09) },
    { ceiling: 28_100_000, rateBps: toBps(0.1) },
    { ceiling: 30_100_000, rateBps: toBps(0.11) },
    { ceiling: 32_600_000, rateBps: toBps(0.12) },
    { ceiling: 35_400_000, rateBps: toBps(0.13) },
    { ceiling: 38_900_000, rateBps: toBps(0.14) },
    { ceiling: 43_000_000, rateBps: toBps(0.15) },
    { ceiling: 47_400_000, rateBps: toBps(0.16) },
    { ceiling: 51_200_000, rateBps: toBps(0.17) },
    { ceiling: 55_800_000, rateBps: toBps(0.18) },
    { ceiling: 60_400_000, rateBps: toBps(0.19) },
    { ceiling: 66_700_000, rateBps: toBps(0.2) },
    { ceiling: 74_500_000, rateBps: toBps(0.21) },
    { ceiling: 83_200_000, rateBps: toBps(0.22) },
    { ceiling: 95_600_000, rateBps: toBps(0.23) },
    { ceiling: 110_000_000, rateBps: toBps(0.24) },
    { ceiling: 134_000_000, rateBps: toBps(0.25) },
    { ceiling: 169_000_000, rateBps: toBps(0.26) },
    { ceiling: 221_000_000, rateBps: toBps(0.27) },
    { ceiling: 390_000_000, rateBps: toBps(0.28) },
    { ceiling: 463_000_000, rateBps: toBps(0.29) },
    { ceiling: 561_000_000, rateBps: toBps(0.3) },
    { ceiling: 709_000_000, rateBps: toBps(0.31) },
    { ceiling: 965_000_000, rateBps: toBps(0.32) },
    { ceiling: 1_419_000_000, rateBps: toBps(0.33) },
    { ceiling: Number.POSITIVE_INFINITY, rateBps: toBps(0.34) },
  ],
}

// TER Harian (PP 58/2023 Lampiran dan PMK 168/2023) tanpa kategori A/B/C:
// penghasilan bruto harian s.d. Rp450.000 tidak dikenai pajak, Rp450.001–
// Rp2.500.000 dikenai 0,5%, dan di atas Rp2.500.000 dikenai tarif Pasal 17
// atas 50% penghasilan bruto harian (lihat hitungPph21Harian di utils.ts).
export const TER_HARIAN_TABLE: Array<{ ceiling: number; rateBps: number }> = [
  { ceiling: 450_000, rateBps: toBps(0) },
  { ceiling: 2_500_000, rateBps: toBps(0.005) },
]

export const TER_HARIAN_PASAL17_THRESHOLD = 2_500_000

export const PPH22_RATES: Record<string, number> = {
  impor: toBps(0.025),
  migas: toBps(0.02),
  bumn: toBps(0.015),
  lainnya: toBps(0.015),
} as const

export const PPH23_RATES: Record<string, number> = {
  jasaTeknik: toBps(0.02),
  jasaKonsultan: toBps(0.04),
  sewaAlat: toBps(0.02),
  dividen: toBps(0.15),
  bunga: toBps(0.15),
} as const

export const PPH4_2_RATES: Record<string, number> = {
  sewaTanah: toBps(0.1),
  konstruksi: toBps(0.035),
  restoran: toBps(0.05),
  umkmFinal: toBps(0.005),
} as const

export const PPN_RATES_PER_YEAR: Record<string, number> = {
  '2022': 0.11,
  '2023': 0.11,
  '2024': 0.11,
  '2025': 0.12,
}

export const PPNBM_RATES: Record<string, number> = {
  kendaraanMewah: toBps(0.2),
  perhiasan: toBps(0.3),
  kapalPesiar: toBps(0.75),
  elektronikPremium: toBps(0.25),
} as const
