import { PPH4_2_RATES } from './constants'
import { applyRate, rateBpsToPercent } from './utils'
import type { TaxResult } from './types'
import i18n from '../../i18n/config'

export type PPh4Objek =
  | 'sewaTanah'
  | 'konstruksi'
  | 'restoran'
  | 'umkmFinal'

export interface PPh4Input {
  objectType: PPh4Objek
  grossAmount: number
}

export function calculatePph4({
  objectType,
  grossAmount,
}: PPh4Input): TaxResult {
  const t = (key: string, fallback: string) =>
    i18n.t(key, { defaultValue: fallback })
  const dpp = Math.max(0, grossAmount)
  const rateBps = PPH4_2_RATES[objectType]
  const totalTax = applyRate(dpp, rateBps)

  return {
    totalTax,
    breakdown: [
      { label: t('pph4_2_calc.breakdown.section', 'Dasar Pengenaan'), variant: 'section' },
      { label: t('pph4_2_calc.breakdown.value', 'Nilai objek'), value: dpp },
      {
        label: t('pph4_2_calc.breakdown.rate', 'Tarif final'),
        value: rateBpsToPercent(rateBps),
        valueType: 'percent',
      },
      { label: t('pph4_2_calc.breakdown.tax', 'PPh Final 4(2)'), value: totalTax, variant: 'total' },
    ],
  }
}
