import { PPH23_RATES } from './constants'
import { applyRate, rateBpsToPercent } from './utils'
import type { TaxResult } from './types'
import i18n from '../../i18n/config'

export type PPh23ServiceType =
  | 'jasaTeknik'
  | 'jasaKonsultan'
  | 'sewaAlat'
  | 'dividen'
  | 'bunga'

export interface PPh23Input {
  serviceType: PPh23ServiceType
  grossAmount: number
  isFinal: boolean
}

export function calculatePph23({
  serviceType,
  grossAmount,
  isFinal,
}: PPh23Input): TaxResult {
  const t = (key: string, fallback: string) =>
    i18n.t(key, { defaultValue: fallback })
  const dpp = Math.max(0, grossAmount)
  const rateBps = PPH23_RATES[serviceType]
  const totalTax = applyRate(dpp, rateBps)
  return {
    totalTax,
    breakdown: [
      { label: t('pph23.breakdown.section', 'Penghasilan Bruto'), variant: 'section' },
      { label: t('pph23.breakdown.gross', 'Jumlah bruto'), value: dpp },
      {
        label: t('pph23.breakdown.rate', 'Tarif PPh 23'),
        value: rateBpsToPercent(rateBps),
        valueType: 'percent',
      },
      {
        label: t('pph23.breakdown.tax', 'PPh 23 dipotong'),
        value: totalTax,
        note: isFinal ? t('pph23.notes.final', 'Final (selesai di pemotong)') : t('pph23.notes.creditable', 'Dapat dikreditkan'),
        variant: 'total',
      },
    ],
  }
}
