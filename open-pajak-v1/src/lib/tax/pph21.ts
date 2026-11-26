import {
  applyRate,
  getPTKP,
  getTerBulananRate,
  getTerHarianRate,
  hitungPajakPasal17,
  rateBpsToPercent,
  roundDownToThousand,
} from './utils'
import { PASAL17_LAYERS } from './constants'
import type { TaxBreakdownRow, TaxResult } from './types'
import i18n from '../../i18n/config'

export type PPh21SubjectType =
  | 'pegawai_tetap'
  | 'pensiunan'
  | 'pegawai_tidak_tetap'
  | 'bukan_pegawai'
  | 'peserta_kegiatan'
  | 'program_pensiun'
  | 'mantan_pegawai'
  | 'wpln'

export interface PPh21Input {
  subjectType: PPh21SubjectType
  brutoMonthly: number
  monthsPaid: number
  pensionContribution: number
  zakatOrDonation: number
  ptkpStatus: string
  scheme: 'lama' | 'ter'
  terCategory: 'A' | 'B' | 'C'
  bonusAnnual: number
  foreignTaxRate: number
  isDailyWorker?: boolean
}

const clampMonths = (months: number) => Math.min(12, Math.max(1, months || 1))
const FIVE_PERCENT_BPS = 500
const FIFTY_PERCENT_BPS = 5000

export function calculatePph21(input: PPh21Input): TaxResult {
  switch (input.subjectType) {
    case 'pegawai_tetap': {
      const months = clampMonths(input.monthsPaid)
      const brutoTahun = input.brutoMonthly * months + input.bonusAnnual
      const iuranTahun = input.pensionContribution * months
      const biayaJabatan = Math.min(applyRate(brutoTahun, FIVE_PERCENT_BPS), 6000000)
      const nettoSetahun =
        brutoTahun - biayaJabatan - iuranTahun - input.zakatOrDonation
      const ptkp = getPTKP(input.ptkpStatus)
      const pkpRounded = roundDownToThousand(Math.max(0, nettoSetahun - ptkp))
      const pajakSetahun = hitungPajakPasal17(pkpRounded)
      return calculatePegawaiTetap(input, {
        months,
        brutoTahun,
        iuranTahun,
        biayaJabatan,
        nettoSetahun,
        ptkp,
        pkpRounded,
        pajakSetahun,
      })
    }
    case 'pensiunan':
      return calculatePensiunan(input)
    case 'pegawai_tidak_tetap':
      return calculatePegawaiTidakTetap(input)
    case 'bukan_pegawai':
      return calculateBukanPegawai(input)
    case 'peserta_kegiatan':
      return flatPasal17(input, 'Peserta kegiatan')
    case 'program_pensiun':
      return flatPasal17(input, 'Penarikan manfaat pensiun')
    case 'mantan_pegawai':
      return flatPasal17(input, 'Mantan pegawai')
    case 'wpln':
      return calculatePph26(input)
    default:
      return { totalTax: 0, breakdown: [] }
  }
}

function calculatePegawaiTetap(
  input: PPh21Input,
  context: {
    months: number
    brutoTahun: number
    iuranTahun: number
    biayaJabatan: number
    nettoSetahun: number
    ptkp: number
    pkpRounded: number
    pajakSetahun: number
  },
): TaxResult {
  const {
    months,
    brutoTahun,
    iuranTahun,
    biayaJabatan,
    nettoSetahun,
    ptkp,
    pkpRounded,
    pajakSetahun,
  } = context

  if (input.scheme === 'ter') {
    const terRateBps = getTerBulananRate(input.terCategory, input.brutoMonthly)
    const masaTax = applyRate(input.brutoMonthly, terRateBps)
    const terMonths = Math.min(11, months)
    const terPaid = masaTax * terMonths

    if (months < 12) {
      const bonusTax = applyRate(input.bonusAnnual, terRateBps)
      const total = terPaid + bonusTax
      const takeHomeAnnual = brutoTahun - total
      const takeHomePerMasa = Math.round(takeHomeAnnual / Math.max(1, months))

      const rows: Array<TaxBreakdownRow> = [
        { label: 'Penghasilan Masa TER', variant: 'section' },
        { label: 'Bruto per masa', value: input.brutoMonthly },
        {
          label: 'Tarif TER',
          value: rateBpsToPercent(terRateBps),
          valueType: 'percent',
        },
        {
          id: 'ter_per_period',
          label: 'PPh 21 TER per masa',
          value: masaTax,
          note: `${months} masa`,
        },
        {
          label: `Akumulasi TER (${months} masa)`,
          value: terPaid,
          variant: 'subtotal',
        },
        { label: 'Pengurang Penghasilan', variant: 'section' },
        {
          label: 'Biaya jabatan (5% maks 6 jt)',
          value: biayaJabatan,
        },
        { label: 'Iuran pensiun (setahun)', value: iuranTahun },
        { label: 'Zakat/sumbangan', value: input.zakatOrDonation },
        { label: 'Netto setahun', value: nettoSetahun, variant: 'subtotal' },
      ]
      if (input.bonusAnnual > 0) {
        rows.push({
          label: 'PPh 21 atas bonus (TER)',
          value: bonusTax,
        })
      }
      rows.push({
        label: 'Total PPh 21 (TER)',
        value: total,
        variant: 'total',
      })
      rows.push({ label: 'Take-home pay', variant: 'section' })
      rows.push({ id: 'take_home_annual', label: 'Take-home setahun', value: takeHomeAnnual })
      rows.push({
        id: 'take_home_period',
        label: 'Take-home per masa',
        value: takeHomePerMasa,
        note: `${months} masa`,
      })

      return {
        totalTax: total,
        breakdown: rows,
      }
    }

    const difference = pajakSetahun - terPaid
    const adjustment = Math.max(0, difference)
    const overpaid = difference < 0 ? Math.abs(difference) : 0
    const totalTax = terPaid + adjustment

    const takeHomeAnnual = brutoTahun - totalTax
    const takeHomePerMasa = Math.round(takeHomeAnnual / Math.max(1, months))

    const pasal17Rows = buildPasal17TierRows(pkpRounded)
    const breakdown = buildWaterfallTerRows({
      months,
      salaryAnnual: input.brutoMonthly * months,
      allowanceAnnual: input.bonusAnnual,
      brutoTahun,
      biayaJabatan,
      iuranTahun,
      zakat: input.zakatOrDonation,
      nettoSetahun,
      ptkp,
      pkpRounded,
      pasal17Rows,
      pajakSetahun,
      terRateBps,
      masaTax,
      terPaid,
      terMonths,
      adjustment,
      overpaid,
      takeHomeAnnual,
      takeHomePerMasa,
    })

    return {
      totalTax,
      breakdown,
    }
  }

  const totalTax = Math.round((pajakSetahun * months) / 12)
  const takeHomeAnnual = brutoTahun - totalTax
  const takeHomePerMasa = Math.round(takeHomeAnnual / Math.max(1, months))

  const breakdown: Array<TaxBreakdownRow> = [
    { label: 'Penghasilan', variant: 'section' },
    { label: 'Bruto setahun', value: brutoTahun },
    { label: 'Pengurang Penghasilan', variant: 'section' },
    { label: 'Biaya jabatan (5% maks 6 jt)', value: biayaJabatan },
    { label: 'Iuran pensiun (setahun)', value: iuranTahun },
    { label: 'Zakat/sumbangan', value: input.zakatOrDonation },
    {
      label: 'Penghasilan neto setahun',
      value: nettoSetahun,
      variant: 'subtotal',
    },
    { label: 'Perhitungan Tahunan', variant: 'section' },
    { label: 'PTKP', value: ptkp },
    { label: 'PKP dibulatkan', value: pkpRounded },
    { label: 'PPh 21 setahun', value: pajakSetahun },
    { label: `PPh 21 ${months} masa`, value: totalTax, variant: 'total' },
    { label: 'Take-home pay', variant: 'section' },
    { id: 'take_home_annual', label: 'Take-home setahun', value: takeHomeAnnual },
    {
      id: 'take_home_period',
      label: 'Take-home per masa',
      value: takeHomePerMasa,
      note: `${months} masa`,
    },
  ]

  return {
    totalTax,
    breakdown,
  }
}

function calculatePensiunan(input: PPh21Input): TaxResult {
  const months = clampMonths(input.monthsPaid)
  const brutoTahun = input.brutoMonthly * months + input.bonusAnnual
  const biayaPensiun = Math.min(applyRate(brutoTahun, FIVE_PERCENT_BPS), 2400000)
  const netto = brutoTahun - biayaPensiun - input.zakatOrDonation
  const ptkp = getPTKP(input.ptkpStatus)
  const pkpRounded = roundDownToThousand(Math.max(0, netto - ptkp))
  const pajakSetahun = hitungPajakPasal17(pkpRounded)
  const totalTax = Math.round((pajakSetahun * months) / 12)

  return {
    totalTax,
    breakdown: [
      { label: 'Penghasilan', variant: 'section' },
      { label: 'Bruto setahun', value: brutoTahun },
      { label: 'Pengurang Penghasilan', variant: 'section' },
      {
        label: 'Biaya pensiun (5%, maks 2.4 juta)',
        value: biayaPensiun,
      },
      {
        label: 'Penghasilan neto setahun',
        value: netto,
        variant: 'subtotal',
      },
      { label: 'Perhitungan Tahunan', variant: 'section' },
      { label: 'PTKP', value: ptkp },
      { label: 'PKP dibulatkan', value: pkpRounded },
      { label: 'PPh 21 setahun', value: pajakSetahun },
      { label: `PPh 21 ${months} masa`, value: totalTax, variant: 'total' },
    ],
  }
}

function calculatePegawaiTidakTetap(input: PPh21Input): TaxResult {
  const months = clampMonths(input.monthsPaid)
  if (input.isDailyWorker) {
    const terRateBps = getTerHarianRate(input.terCategory, input.brutoMonthly)
    const taxPerDay = applyRate(input.brutoMonthly, terRateBps)
    const total = taxPerDay * months
    return {
      totalTax: total,
      breakdown: [
        { label: 'Penghasilan Harian', variant: 'section' },
        { label: 'Upah harian', value: input.brutoMonthly },
        {
          label: 'Tarif TER harian',
          value: rateBpsToPercent(terRateBps),
          valueType: 'percent',
        },
        { label: 'PPh 21 per hari', value: taxPerDay },
        { label: 'Total masa', value: total, variant: 'total' },
      ],
    }
  }

  if (input.brutoMonthly <= 2500000) {
    const terRateBps = getTerBulananRate(input.terCategory, input.brutoMonthly)
    const masaTax = applyRate(input.brutoMonthly, terRateBps)
    return {
      totalTax: masaTax * months,
      breakdown: [
        { label: 'Penghasilan', variant: 'section' },
        { label: 'Bruto bulanan', value: input.brutoMonthly },
        {
          label: 'Tarif TER',
          value: rateBpsToPercent(terRateBps),
          valueType: 'percent',
        },
        { label: 'PPh 21 per masa', value: masaTax },
        { label: 'Total masa', value: masaTax * months, variant: 'total' },
      ],
    }
  }

  const dpp = applyRate(input.brutoMonthly, FIFTY_PERCENT_BPS)
  const pajakMasa = hitungPajakPasal17(dpp)
  const totalTax = pajakMasa * months

  return {
    totalTax,
    breakdown: [
      { label: 'Penghasilan', variant: 'section' },
      { label: 'Bruto bulanan', value: input.brutoMonthly },
      { label: 'DPP (50% bruto)', value: dpp },
      { label: 'PPh 21 per masa', value: pajakMasa },
      { label: 'Total', value: totalTax, variant: 'total' },
    ],
  }
}

function calculateBukanPegawai(input: PPh21Input): TaxResult {
  const bruto = input.brutoMonthly * input.monthsPaid + input.bonusAnnual
  const dpp = applyRate(bruto, FIFTY_PERCENT_BPS)
  const tax = hitungPajakPasal17(dpp)
  return {
    totalTax: tax,
    breakdown: [
      { label: 'Penghasilan', variant: 'section' },
      { label: 'Bruto', value: bruto },
      { label: 'DPP (50% bruto)', value: dpp },
      { label: 'PPh 21 final', value: tax, variant: 'total' },
    ],
  }
}

function flatPasal17(input: PPh21Input, heading: string): TaxResult {
  const bruto = input.brutoMonthly * input.monthsPaid + input.bonusAnnual
  const tax = hitungPajakPasal17(bruto)
  return {
    totalTax: tax,
    breakdown: [
      { label: heading, variant: 'section' },
      { label: 'Penghasilan bruto', value: bruto },
      { label: 'DPP', value: bruto },
      { label: 'PPh 21 final', value: tax, variant: 'total' },
    ],
  }
}

const integerFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
})

function formatNumber(value: number) {
  return integerFormatter.format(Math.round(value))
}

function formatPercentLabel(rateBps: number) {
  const percent = rateBps / 100
  return percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(2)}%`
}

function buildPasal17TierRows(pkpRounded: number): TaxBreakdownRow[] {
  let remaining = pkpRounded
  let lowerBound = 0
  const layers: TaxBreakdownRow[] = []
  PASAL17_LAYERS.forEach((layer, index) => {
    if (remaining <= 0) {
      return
    }
    const taxable = Math.min(remaining, layer.limit)
    if (taxable <= 0) return
    const upperBound = lowerBound + taxable
    layers.push({
      label: `Tier ${index + 1}: ${formatPercentLabel(layer.rateBps)} × ${formatNumber(
        taxable,
      )}`,
      value: applyRate(taxable, layer.rateBps),
      note: `Lapisan PKP ${formatNumber(lowerBound)} – ${formatNumber(upperBound)}`,
    })
    remaining -= taxable
    lowerBound += layer.limit
  })
  return layers
}

function buildWaterfallTerRows({
  months,
  salaryAnnual,
  allowanceAnnual,
  brutoTahun,
  biayaJabatan,
  iuranTahun,
  zakat,
  nettoSetahun,
  ptkp,
  pkpRounded,
  pasal17Rows,
  pajakSetahun,
  terRateBps,
  masaTax,
  terPaid,
  terMonths,
  adjustment,
  overpaid,
  takeHomeAnnual,
  takeHomePerMasa,
}: {
  months: number
  salaryAnnual: number
  allowanceAnnual: number
  brutoTahun: number
  biayaJabatan: number
  iuranTahun: number
  zakat: number
  nettoSetahun: number
  ptkp: number
  pkpRounded: number
  pasal17Rows: TaxBreakdownRow[]
  pajakSetahun: number
  terRateBps: number
  masaTax: number
  terPaid: number
  terMonths: number
  adjustment: number
  overpaid: number
  takeHomeAnnual: number
  takeHomePerMasa: number
}): TaxBreakdownRow[] {
  const t = (key: string, fallback: string, options?: Record<string, unknown>) =>
    i18n.t(key, { defaultValue: fallback, ...options })
  const rows: TaxBreakdownRow[] = []
  const totalPengurang = biayaJabatan + iuranTahun + zakat

  rows.push({ label: t('pph21Waterfall.groups.gross', 'A. Penghasilan Bruto (Gross)'), variant: 'group' })
  rows.push({
    label: t('pph21Waterfall.rows.salaryAnnual', 'Gaji pokok (setahun)'),
    value: salaryAnnual,
    note: t('pph21Waterfall.notes.salaryAnnual', 'Estimasi {{months}} masa', { months }),
  })
  rows.push({
    label: t('pph21Waterfall.rows.allowanceAnnual', 'Tunjangan/bonus (setahun)'),
    value: allowanceAnnual,
    note: t('pph21Waterfall.notes.allowanceAnnual', 'Tunjangan tetap / bonus / THR'),
  })
  rows.push({
    label: t('pph21Waterfall.rows.totalGross', 'Total bruto setahun'),
    value: brutoTahun,
    variant: 'subtotal',
    note: t('pph21Waterfall.notes.totalGross', 'Total penghasilan kotor'),
  })
  rows.push({ label: '', variant: 'spacer' })

  rows.push({ label: t('pph21Waterfall.groups.deductions', 'B. Pengurang (Deductions)'), variant: 'group' })
  rows.push({
    label: t('pph21Waterfall.rows.jobCost', 'Biaya jabatan'),
    value: -biayaJabatan,
    note: t('pph21Waterfall.notes.jobCost', '5% × bruto, maks 6 juta/tahun'),
  })
  rows.push({
    label: t('pph21Waterfall.rows.pension', 'Iuran pensiun/JHT'),
    value: -iuranTahun,
    note: t('pph21Waterfall.notes.pension', 'Bagian yang dibayar karyawan'),
  })
  if (zakat > 0) {
    rows.push({
      label: t('pph21Waterfall.rows.zakat', 'Zakat/sumbangan'),
      value: -zakat,
      note: t('pph21Waterfall.notes.zakat', 'Melalui pemberi kerja'),
    })
  }
  rows.push({
    label: t('pph21Waterfall.rows.totalDeductions', 'Total pengurang'),
    value: -totalPengurang,
    variant: 'subtotal',
  })
  rows.push({ label: '', variant: 'spacer' })

  rows.push({ label: t('pph21Waterfall.groups.basis', 'C. Basis Perhitungan Pajak'), variant: 'group' })
  rows.push({
    label: t('pph21Waterfall.rows.netIncome', 'Penghasilan netto'),
    value: nettoSetahun,
    note: t('pph21Waterfall.notes.netIncome', 'Bruto - pengurang'),
  })
  rows.push({
    label: t('pph21Waterfall.rows.ptkp', 'PTKP'),
    value: -ptkp,
    note: t('pph21Waterfall.notes.ptkp', 'Berdasarkan status keluarga'),
  })
  rows.push({
    label: t('pph21Waterfall.rows.pkpRounded', 'PKP (dibulatkan)'),
    value: pkpRounded,
    variant: 'subtotal',
  })
  rows.push({ label: '', variant: 'spacer' })

  rows.push({
    label: t('pph21Waterfall.groups.taxDue', 'D. Pajak terutang (tarif Pasal 17)'),
    variant: 'group',
  })
  rows.push(
    ...pasal17Rows.map((tier) => ({
      ...tier,
      note: tier.note,
    })),
  )
  rows.push({
    label: t('pph21Waterfall.rows.totalTaxYear', 'Total PPh 21 seharusnya (setahun)'),
    value: pajakSetahun,
    variant: 'subtotal',
    note: t('pph21Waterfall.notes.totalTaxYear', 'Kewajiban pajak 1 tahun'),
  })
  rows.push({ label: '', variant: 'spacer' })

  rows.push({ label: t('pph21Waterfall.groups.settlement', 'E. Status pembayaran (Settlement)'), variant: 'group' })
  rows.push({
    id: 'ter_per_period',
    label: t('pph21Waterfall.rows.terPerPeriod', 'PPh 21 TER per masa'),
    value: masaTax,
    note: t('pph21Waterfall.notes.terPerPeriod', 'Tarif {{rate}} × bruto per masa', {
      rate: formatPercentLabel(terRateBps),
    }),
  })
  rows.push({
    label: t('pph21Waterfall.rows.terPaid', '(-) Sudah dipotong Jan–Nov (TER)'),
    value: -terPaid,
    note: t('pph21Waterfall.notes.terPaid', 'Tarif {{rate}} × {{months}} masa', {
      rate: formatPercentLabel(terRateBps),
      months: terMonths,
    }),
  })
  if (overpaid > 0) {
    rows.push({
      label: t('pph21Waterfall.rows.overpaid', 'Kelebihan TER'),
      value: overpaid,
      note: t('pph21Waterfall.notes.overpaid', 'TER melebihi hasil Pasal 17'),
    })
  }
  rows.push({
    id: 'december_adjustment',
    label: t('pph21Waterfall.rows.decemberAdjustment', 'PPh 21 masa Desember (kurang bayar)'),
    value: adjustment,
    variant: 'total',
    note: t('pph21Waterfall.notes.decemberAdjustment', 'Sisa kewajiban Desember'),
  })
  rows.push({ label: '', variant: 'spacer' })

  rows.push({ label: t('pph21Waterfall.groups.takeHome', 'F. Take-home pay'), variant: 'group' })
  rows.push({
    id: 'take_home_annual',
    label: t('pph21Waterfall.rows.takeHomeAnnual', 'Take-home setahun'),
    value: takeHomeAnnual,
    note: t('pph21Waterfall.notes.takeHomeAnnual', 'Bruto - pajak terutang'),
  })
  rows.push({
    id: 'take_home_period',
    label: t('pph21Waterfall.rows.takeHomePeriod', 'Take-home per masa'),
    value: takeHomePerMasa,
    note: t('pph21Waterfall.notes.takeHomePeriod', '{{months}} masa', { months }),
  })

  return rows
}

function calculatePph26(input: PPh21Input): TaxResult {
  const months = clampMonths(input.monthsPaid)
  const salaryAnnual = input.brutoMonthly * months
  const allowanceAnnual = input.bonusAnnual
  const bruto = salaryAnnual + allowanceAnnual
  const foreignRatePercent = input.foreignTaxRate ?? 20
  const rateBps = Math.max(0, Math.round(foreignRatePercent * 100))
  const tax = applyRate(bruto, rateBps)
  const rows: TaxBreakdownRow[] = [
    { label: 'A. Penghasilan bruto WPLN', variant: 'group' },
    {
      label: 'Honorarium/jasa (setahun)',
      value: salaryAnnual,
      note: `${months} masa`,
    },
    {
      label: 'Bonus/tunjangan',
      value: allowanceAnnual,
      note: 'Tambahan tahunan',
    },
    {
      label: 'Total bruto setahun',
      value: bruto,
      variant: 'subtotal',
    },
    { label: '', variant: 'spacer' },
    { label: 'B. Tarif PPh 26', variant: 'group' },
    {
      label: 'Tarif efektif',
      value: rateBpsToPercent(rateBps),
      valueType: 'percent',
      note: 'Treaty / PMK 164/2023',
    },
    { label: '', variant: 'spacer' },
    { label: 'C. Pajak terutang', variant: 'group' },
    {
      label: 'PPh 26 final',
      value: tax,
      variant: 'total',
      note: 'Bukti potong 1721-VI',
    },
  ]
  return {
    totalTax: tax,
    breakdown: rows,
  }
}
