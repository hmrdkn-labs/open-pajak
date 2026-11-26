import { PPH22_RATES } from './constants'
import { applyRate, rateBpsToPercent } from './utils'
import type { TaxResult } from './types'
import i18n from '../../i18n/config'

export type PPh22TransactionType =
  | 'impor'
  | 'migas'
  | 'bumn'
  | 'lainnya'

export interface PPh22Input {
  transactionType: PPh22TransactionType
  transactionValue: number
  otherCosts: number
  deduction: number
}

export function calculatePph22({
  transactionType,
  transactionValue,
  otherCosts,
  deduction,
}: PPh22Input): TaxResult {
  const t = (key: string, fallback: string, options?: Record<string, unknown>) =>
    i18n.t(key, { defaultValue: fallback, ...options })
  const dpp = Math.max(0, transactionValue + otherCosts - deduction)
  const rateBps = PPH22_RATES[transactionType]
  const totalTax = applyRate(dpp, rateBps)

  return {
    totalTax,
    breakdown: [
      { label: t('pph22.breakdown.baseSection', 'Dasar Pengenaan'), variant: 'section' },
      { label: t('pph22.breakdown.transaction', 'Nilai transaksi'), value: transactionValue },
      {
        label: t('pph22.breakdown.otherCosts', 'Penyesuaian biaya'),
        value: otherCosts,
        note: t('pph22.notes.otherCosts', '+ biaya lain'),
      },
      {
        label: t('pph22.breakdown.deduction', 'Pengurang'),
        value: deduction,
        note: t('pph22.notes.deduction', '- potongan'),
      },
      {
        label: t('pph22.breakdown.dpp', 'Dasar pungut (DPP)'),
        value: dpp,
        variant: 'subtotal',
      },
      { label: t('pph22.breakdown.taxSection', 'Pajak Terutang'), variant: 'section' },
      {
        label: t('pph22.breakdown.rate', 'Tarif PPh 22'),
        value: rateBpsToPercent(rateBps),
        valueType: 'percent',
      },
      { label: t('pph22.breakdown.tax', 'PPh 22 dipungut'), value: totalTax, variant: 'total' },
    ],
  }
}
