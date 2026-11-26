import {
  PASAL17_LAYERS,
  PTKP_TABLE,
  RATE_SCALE,
  TER_BULANAN_TABLE,
  TER_HARIAN_PASAL17_THRESHOLD,
  TER_HARIAN_TABLE,
} from './constants'

export function getPTKP(status: string) {
  return PTKP_TABLE[status] ?? PTKP_TABLE['TK/0']
}

export function roundDown(value: number) {
  return Math.max(0, Math.floor(value))
}

export function roundDownToThousand(value: number) {
  return Math.max(0, Math.floor(value / 1000) * 1000)
}

const SCALE_BIGINT = BigInt(RATE_SCALE)
const FIFTY_PERCENT_BPS = RATE_SCALE / 2

export function applyRate(
  amount: number,
  rateBps: number,
  rounding: 'nearest' | 'floor' = 'nearest',
) {
  const base = BigInt(Math.round(amount))
  const numerator = base * BigInt(rateBps)
  if (rounding === 'floor') {
    return Number(numerator / SCALE_BIGINT)
  }
  const half = SCALE_BIGINT / 2n
  return Number((numerator + half) / SCALE_BIGINT)
}

export function rateBpsToPercent(rateBps: number) {
  return rateBps / RATE_SCALE
}

export function hitungPajakPasal17(pkp: number) {
  let remaining = pkp
  let tax = 0
  for (const layer of PASAL17_LAYERS) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, layer.limit)
    tax += applyRate(taxable, layer.rateBps)
    remaining -= taxable
  }
  return tax
}

export function getTerBulananRate(
  kategori: string,
  brutoBulanan: number,
) {
  const table = TER_BULANAN_TABLE[kategori] ?? TER_BULANAN_TABLE.A
  const fallbackRate = table.at(-1)?.rateBps ?? 0
  const found = table.find((row) => brutoBulanan <= row.ceiling)
  return found ? found.rateBps : fallbackRate
}

export function getTerHarianRate(bruto: number) {
  const found = TER_HARIAN_TABLE.find((row) => bruto <= row.ceiling)
  return found ? found.rateBps : 0
}

// TER Harian (PP 58/2023 Lampiran dan PMK 168/2023): s.d. Rp2.500.000/hari
// dikenai tarif tabel di atas; di atas Rp2.500.000/hari dikenai tarif Pasal 17
// atas 50% penghasilan bruto harian.
export function hitungPph21Harian(bruto: number) {
  if (bruto > TER_HARIAN_PASAL17_THRESHOLD) {
    return hitungPajakPasal17(applyRate(bruto, FIFTY_PERCENT_BPS))
  }
  return applyRate(bruto, getTerHarianRate(bruto))
}
