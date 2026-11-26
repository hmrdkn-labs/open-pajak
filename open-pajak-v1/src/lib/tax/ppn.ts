import { PPN_RATES_PER_YEAR, RATE_SCALE } from './constants'
import { applyRate, rateBpsToPercent } from './utils'
import type { TaxResult } from './types'
import i18n from '../../i18n/config'

export interface PpnInput {
  taxYear: string
  basePrice: number
  discount: number
  otherCosts: number
  customRate?: number
  includePpn: boolean
}

export function calculatePpn({
  taxYear,
  basePrice,
  discount,
  otherCosts,
  customRate,
  includePpn,
}: PpnInput): TaxResult {
  const t = (key: string, fallback: string, options?: Record<string, unknown>) =>
    i18n.t(key, { defaultValue: fallback, ...options })
  const rateBps =
    customRate && customRate > 0
      ? Math.round(customRate * 100)
      : PPN_RATES_PER_YEAR[taxYear] ?? PPN_RATES_PER_YEAR['2024']
  const rateDecimal = rateBpsToPercent(rateBps)
  const grossBase = Math.max(0, basePrice - discount + otherCosts)

  let dpp: number
  let ppn: number
  if (includePpn) {
    const numerator = BigInt(Math.round(grossBase)) * BigInt(RATE_SCALE)
    const denominator = BigInt(RATE_SCALE + rateBps)
    dpp = Number((numerator + denominator / 2n) / denominator)
    ppn = grossBase - dpp
  } else {
    dpp = grossBase
    ppn = applyRate(dpp, rateBps)
  }

  return {
    totalTax: ppn,
    breakdown: [
      { label: t('ppnCalc.breakdown.baseSection', 'Dasar Pengenaan'), variant: 'section' },
      {
        label: t('ppnCalc.breakdown.dpp', 'DPP'),
        value: dpp,
        note: includePpn
          ? t('ppnCalc.notes.dppInclusive', 'harga termasuk PPN')
          : t('ppnCalc.notes.dppExclusive', 'harga sebelum PPN'),
        variant: 'subtotal',
      },
      { label: t('ppnCalc.breakdown.taxSection', 'Perhitungan PPN'), variant: 'section' },
      {
        label: t('ppnCalc.breakdown.rate', 'Tarif PPN'),
        value: rateDecimal,
        valueType: 'percent',
      },
      { label: t('ppnCalc.breakdown.tax', 'PPN terutang'), value: ppn },
      { label: t('ppnCalc.breakdown.total', 'Total tagihan'), value: dpp + ppn, variant: 'total' },
    ],
  }
}
