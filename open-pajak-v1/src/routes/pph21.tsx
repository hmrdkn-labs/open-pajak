import { createFileRoute } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormField } from '../components/FormField'
import { FormulaExplanationCard } from '../components/FormulaExplanationCard'
import { InfoAlert } from '../components/InfoAlert'
import { TaxFormSection } from '../components/TaxFormSection'
import { TaxPageLayout } from '../components/TaxPageLayout'
import { TaxResultTable } from '../components/TaxResultTable'
import { TaxSummaryCard } from '../components/TaxSummaryCard'
import { ReceiptActionsPanel } from '../components/ReceiptActionsPanel'
import { ReceiptModal } from '../components/ReceiptModal'
import { ReceiptHistoryDrawer } from '../components/ReceiptHistoryDrawer'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { NumberInput } from '../components/ui/number-input'
import { Select } from '../components/ui/select'
import { calculatePph21 } from '../lib/tax/pph21'
import type { PPh21SubjectType } from '../lib/tax/pph21'
import type { TaxBreakdownRow } from '../lib/tax/types'
import type { ReceiptPreviewData } from '../components/ReceiptPreview'
import { useReceipts } from '../lib/hooks/useReceipts'
import {
  downloadBatchWorkbook,
  downloadReceiptWorkbook,
  downloadWorkbook,
  openPrintableReceipt,
  parseSpreadsheetXml,
} from '../lib/receiptExport'
import type { ReceiptTaxType, TaxReceipt } from '../lib/storage/receipts'

export const Route = createFileRoute('/pph21')({
  component: Pph21Page,
})

const SUBJECT_OPTIONS: Array<{ value: PPh21SubjectType; labelKey: string }> = [
  { value: 'pegawai_tetap', labelKey: 'pph21.subjectOptions.pegawai_tetap' },
  { value: 'pensiunan', labelKey: 'pph21.subjectOptions.pensiunan' },
  { value: 'pegawai_tidak_tetap', labelKey: 'pph21.subjectOptions.pegawai_tidak_tetap' },
  { value: 'bukan_pegawai', labelKey: 'pph21.subjectOptions.bukan_pegawai' },
  { value: 'peserta_kegiatan', labelKey: 'pph21.subjectOptions.peserta_kegiatan' },
  { value: 'program_pensiun', labelKey: 'pph21.subjectOptions.program_pensiun' },
  { value: 'mantan_pegawai', labelKey: 'pph21.subjectOptions.mantan_pegawai' },
  { value: 'wpln', labelKey: 'pph21.subjectOptions.wpln' },
]

const ptkpOptions: Array<string> = [
  'TK/0',
  'TK/1',
  'TK/2',
  'TK/3',
  'K/0',
  'K/1',
  'K/2',
  'K/3',
]

const PTKP_TER_MAPPING: Partial<Record<string, 'A' | 'B' | 'C'>> = {
  'TK/0': 'A',
  'TK/1': 'A',
  'K/0': 'A',
  'TK/2': 'B',
  'TK/3': 'B',
  'K/1': 'B',
  'K/2': 'B',
  'K/3': 'C',
}

const TER_DEFAULTS: Partial<Record<PPh21SubjectType, 'A' | 'B' | 'C'>> = {
  pegawai_tetap: 'A',
  pensiunan: 'A',
  program_pensiun: 'A',
  mantan_pegawai: 'A',
  pegawai_tidak_tetap: 'B',
  peserta_kegiatan: 'B',
  bukan_pegawai: 'C',
}

type Pph21FormState = {
  subjectType: PPh21SubjectType
  brutoMonthly: number | null
  monthsPaid: number
  pensionContribution: number | null
  zakatOrDonation: number | null
  ptkpStatus: string
  scheme: 'lama' | 'ter'
  terCategory: 'A' | 'B' | 'C'
  bonusAnnual: number | null
  foreignTaxRate: number
  isDailyWorker: boolean
}

const createSampleForm = (): Pph21FormState => ({
  subjectType: 'pegawai_tetap',
  brutoMonthly: 15000000,
  monthsPaid: 12,
  pensionContribution: 200000,
  zakatOrDonation: 0,
  ptkpStatus: 'K/0',
  scheme: 'ter',
  terCategory: 'A',
  bonusAnnual: 20000000,
  foreignTaxRate: 20,
  isDailyWorker: false,
})

const createEmptyForm = (): Pph21FormState => ({
  subjectType: 'pegawai_tetap',
  brutoMonthly: null,
  monthsPaid: 1,
  pensionContribution: null,
  zakatOrDonation: null,
  ptkpStatus: 'TK/0',
  scheme: 'ter',
  terCategory: 'A',
  bonusAnnual: null,
  foreignTaxRate: 20,
  isDailyWorker: false,
})

type BulkRow = Partial<Record<string, string>>

type BulkStatus = {
  state: 'idle' | 'pending' | 'success' | 'error'
  message?: string
}

const BULK_TEMPLATE_HEADERS = [
  'recordName',
  'groupName',
  'taxType',
  'subjectType',
  'brutoMonthly',
  'monthsPaid',
  'pensionContribution',
  'bonusAnnual',
  'zakatOrDonation',
  'ptkpStatus',
  'scheme',
  'terCategory',
  'foreignTaxRate',
  'isDailyWorker',
]

const BULK_TEMPLATE_ROWS = [
  [
    'Karyawan A',
    'Project Alpha',
    'pph21',
    'pegawai_tetap',
    '15000000',
    '12',
    '200000',
    '20000000',
    '0',
    'K/0',
    'ter',
    'A',
    '0',
    'false',
  ],
  [
    'Konsultan B',
    'Project Alpha',
    'pph26',
    'wpln',
    '25000000',
    '12',
    '0',
    '0',
    '0',
    'TK/0',
    'lama',
    'A',
    '20',
    'false',
  ],
]

const BULK_TEMPLATE_SHEET: Array<Array<string>> = [
  BULK_TEMPLATE_HEADERS,
  ...BULK_TEMPLATE_ROWS,
]

const slugifyGroup = (value?: string | null) => {
  if (!value) return undefined
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SUBJECT_TYPES: Array<PPh21SubjectType> = [
  'pegawai_tetap',
  'pensiunan',
  'pegawai_tidak_tetap',
  'bukan_pegawai',
  'peserta_kegiatan',
  'program_pensiun',
  'mantan_pegawai',
  'wpln',
]

const extractMetrics = (rows: Array<TaxBreakdownRow>) => {
  const findValue = (id: string, fallbackLabel: string) => {
    const row =
      rows.find((item) => item.id === id) ??
      rows.find((item) => item.label === fallbackLabel)
    return typeof row?.value === 'number' ? row.value : undefined
  }
  return {
    takeHomeAnnual: findValue('take_home_annual', 'Take-home setahun'),
    takeHomePerPeriod: findValue('take_home_period', 'Take-home per masa'),
    terPerPeriod: findValue('ter_per_period', 'PPh 21 TER per masa'),
    decemberAdjustment: findValue(
      'december_adjustment',
      'Penyesuaian Desember',
    ),
  }
}

const parseCsvRows = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length <= 1) return []
  const headers = lines[0].split(',').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((cell) => cell.trim())
    const entry: BulkRow = {}
    headers.forEach((header, index) => {
      entry[header] = values[index] ?? ''
    })
    return entry
  })
}

const toNumber = (value?: string | null) => {
  if (!value) return 0
  const numeric = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

const toBoolean = (value?: string | null) => {
  if (!value) return false
  return ['true', 'yes', '1'].includes(value.toLowerCase())
}

const sanitizeSubjectType = (value?: string): PPh21SubjectType => {
  if (!value) return 'pegawai_tetap'
  const lower = value.toLowerCase()
  const match = SUBJECT_TYPES.find((type) => type === lower)
  if (match) return match
  if (lower === 'pph26') return 'wpln'
  return 'pegawai_tetap'
}

const buildSnapshot = ({
  subjectLabel,
  brutoMonthly,
  monthsPaid,
  pensionContribution,
  bonusAnnual,
  ptkpStatus,
  schemeLabel,
  terCategory,
  zakatOrDonation,
  foreignTaxRate,
  isDailyWorker,
}: {
  subjectLabel: string
  brutoMonthly: number
  monthsPaid: number
  pensionContribution: number
  bonusAnnual: number
  ptkpStatus: string
  schemeLabel: string
  terCategory: string
  zakatOrDonation: number
  foreignTaxRate: number
  isDailyWorker: boolean
}) => ({
  subjectType: subjectLabel,
  brutoMonthly,
  monthsPaid,
  pensionContribution,
  bonusAnnual,
  ptkpStatus,
  scheme: schemeLabel,
  terCategory,
  zakatOrDonation,
  foreignTaxRate,
  isDailyWorker,
})

const clampMonthsValue = (value: number) => Math.min(12, Math.max(1, Math.round(value || 1)))

const parseSpreadsheetRows = (matrix: Array<Array<string>>): Array<BulkRow> => {
  if (!matrix.length) return []
  const headers = matrix[0].map((header) => header.trim())
  return matrix.slice(1).map((row) => {
    const entry: BulkRow = {}
    headers.forEach((header, index) => {
      entry[header] = row[index] ?? ''
    })
    return entry
  })
}

const readBulkFile = async (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const text = await file.text()
  if (extension === 'xls' || extension === 'xml') {
    const matrix = parseSpreadsheetXml(text)
    return parseSpreadsheetRows(matrix)
  }
  return parseCsvRows(text)
}

function Pph21Page() {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState<Pph21FormState>(createSampleForm)
  const { receipts, batches, saveReceipt, deleteReceipt, saveBatch } = useReceipts()
  const [modalData, setModalData] = useState<ReceiptPreviewData | null>(null)
  const [modalMode, setModalMode] = useState<'draft' | 'saved'>('draft')
  const [selectedReceipt, setSelectedReceipt] = useState<TaxReceipt | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>({ state: 'idle' })

  useEffect(() => {
    const terFromStatus = PTKP_TER_MAPPING[form.ptkpStatus]
    const terFromSubject = TER_DEFAULTS[form.subjectType]
    const nextTer = terFromStatus ?? terFromSubject
    if (nextTer && nextTer !== form.terCategory) {
      setForm((prev) => ({ ...prev, terCategory: nextTer }))
    }
  }, [form.ptkpStatus, form.subjectType, form.terCategory])

  const handleNumberChange = (
    field: keyof typeof form,
    value: string,
  ) => {
    const numeric = Number(value)
    setForm((prev) => ({
      ...prev,
      [field]: Number.isFinite(numeric) ? numeric : 0,
    }))
  }

  const subjectOptions = useMemo(
    () =>
      SUBJECT_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t, i18n.language],
  )

  const normalizedForm = useMemo(
    () => ({
      ...form,
      brutoMonthly: form.brutoMonthly ?? 0,
      pensionContribution: form.pensionContribution ?? 0,
      zakatOrDonation: form.zakatOrDonation ?? 0,
      bonusAnnual: form.bonusAnnual ?? 0,
    }),
    [form],
  )
  const {
    brutoMonthly,
    monthsPaid,
    pensionContribution,
    bonusAnnual,
    zakatOrDonation,
    foreignTaxRate,
    isDailyWorker,
  } = normalizedForm

  const result = useMemo(
    () => calculatePph21(normalizedForm),
    [normalizedForm, i18n.language],
  )
  const metrics = useMemo(
    () => extractMetrics(result.breakdown),
    [result.breakdown, i18n.language],
  )
  const { takeHomeAnnual, takeHomePerPeriod, terPerPeriod, decemberAdjustment } = metrics
  const summaryPayload = useMemo(
    () => ({
      totalTax: result.totalTax,
      takeHomeAnnual,
      takeHomePerPeriod,
      terPerPeriod,
      decemberAdjustment,
    }),
    [result.totalTax, takeHomeAnnual, takeHomePerPeriod, terPerPeriod, decemberAdjustment],
  )
  const receiptType: ReceiptTaxType = form.subjectType === 'wpln' ? 'pph26' : 'pph21'
  const subjectLabel = t(`pph21.subjectOptions.${form.subjectType}`)
  const schemeLabel = t(`pph21.schemeOptions.${form.scheme}`)
  const formSnapshot = useMemo(
    () =>
      buildSnapshot({
        subjectLabel,
        brutoMonthly,
        monthsPaid,
        pensionContribution,
        bonusAnnual,
        ptkpStatus: form.ptkpStatus,
        schemeLabel,
        terCategory: form.terCategory,
        zakatOrDonation,
        foreignTaxRate,
        isDailyWorker,
      }),
    [
      subjectLabel,
      brutoMonthly,
      monthsPaid,
      pensionContribution,
      bonusAnnual,
      form.ptkpStatus,
      schemeLabel,
      form.terCategory,
      zakatOrDonation,
      foreignTaxRate,
      isDailyWorker,
      i18n.language,
    ],
  )
  const defaultTitle = t('receipts.defaultTitle', {
    type: receiptType === 'pph26' ? 'PPh 26' : 'PPh 21',
  })
  const receiptDraft = useMemo(
    () => ({
      title: defaultTitle,
      type: receiptType,
      subjectType: form.subjectType,
      summary: summaryPayload,
      breakdown: result.breakdown,
      formSnapshot,
      source: 'manual' as const,
    }),
    [
      defaultTitle,
      receiptType,
      form.subjectType,
      summaryPayload,
      result.breakdown,
      formSnapshot,
      i18n.language,
    ],
  )
  const draftPreviewData: ReceiptPreviewData = useMemo(
    () => ({
      title: receiptDraft.title,
      summary: receiptDraft.summary,
      breakdown: receiptDraft.breakdown,
      formSnapshot: receiptDraft.formSnapshot,
      sourceLabel: t('receipts.modal.source.manual'),
      locale: i18n.language,
    }),
    [
      receiptDraft.title,
      receiptDraft.summary,
      receiptDraft.breakdown,
      receiptDraft.formSnapshot,
      t,
      i18n.language,
    ],
  )
  const totalNegatives = Object.entries(form).filter(
    ([, value]) => typeof value === 'number' && value < 0,
  )
  const hasError = totalNegatives.length > 0

  const infoItems = t('pph21.info.points', {
    returnObjects: true,
  }) as string[]

  const openPreview = () => {
    setModalMode('draft')
    setSelectedReceipt(null)
    setModalData({
      ...draftPreviewData,
      locale: i18n.language,
    })
  }

  const closeModal = () => {
    setModalData(null)
    setSelectedReceipt(null)
    setModalMode('draft')
  }

  const currentReceiptForExport = (): TaxReceipt | null => {
    if (!modalData) return null
    if (modalMode === 'saved' && selectedReceipt) {
      return selectedReceipt
    }
    return {
      id: `preview-${Date.now()}`,
      type: receiptType,
      subjectType: form.subjectType,
      title: modalData.title,
      summary: modalData.summary,
      breakdown: modalData.breakdown,
      identifier: modalData.identifier,
      groupName: modalData.groupName,
      createdAt: modalData.createdAt ?? new Date().toISOString(),
      source: 'manual' as const,
      locale: modalData.locale ?? i18n.language,
      formSnapshot: modalData.formSnapshot,
    }
  }

  const handleSaveReceipt = ({
    title,
    identifier,
    groupName,
  }: {
    title: string
    identifier?: string
    groupName?: string
  }) => {
    const record = saveReceipt({
      ...receiptDraft,
      title,
      identifier,
      groupName,
      groupId: slugifyGroup(groupName),
      locale: i18n.language,
    })
    setSelectedReceipt(record)
    setModalMode('saved')
    setModalData((prev) =>
      prev
        ? {
            ...prev,
            title,
            identifier,
            groupName,
            createdAt: record.createdAt,
            sourceLabel:
              record.source === 'bulk'
                ? t('receipts.modal.source.bulk')
                : t('receipts.modal.source.manual'),
          }
        : prev,
    )
  }

  const handleDownloadCurrent = () => {
    const receipt = currentReceiptForExport()
    if (!receipt) return
    downloadReceiptWorkbook(receipt)
  }

  const handlePrintCurrent = () => {
    const receipt = currentReceiptForExport()
    if (!receipt) return
    openPrintableReceipt(receipt)
  }

  const handleViewReceipt = (record: TaxReceipt) => {
    setSelectedReceipt(record)
    setModalMode('saved')
    setModalData(mapRecordToPreview(record, t))
  }

  const handleDeleteReceipt = (record: TaxReceipt) => {
    deleteReceipt(record.id)
    if (selectedReceipt?.id === record.id) {
      closeModal()
    }
  }

  const handleDownloadReceipt = (record: TaxReceipt) => {
    downloadReceiptWorkbook(record)
  }

  const handlePrintReceipt = (record: TaxReceipt) => {
    openPrintableReceipt(record)
  }

  const handleDownloadBatch = (batchId: string) => {
    const batch = batches.find((item) => item.id === batchId)
    if (!batch) return
    const entries = receipts.filter((entry) => batch.recordIds.includes(entry.id))
    if (!entries.length) return
    downloadBatchWorkbook(batch, entries)
  }

  const handleDownloadTemplate = () => {
    downloadWorkbook('open-pajak-bulk-template.xls', [
      { name: 'Bulk Template', rows: BULK_TEMPLATE_SHEET },
    ])
  }

  const handleBulkUpload = async (file: File) => {
    try {
      const rows = await readBulkFile(file)
      if (!rows.length) {
        setBulkStatus({ state: 'error', message: t('receipts.bulk.error') })
        return
      }
      setBulkStatus({
        state: 'pending',
        message: t('receipts.bulk.pending', { count: rows.length }),
      })
      const created: Array<TaxReceipt> = []
      for (const row of rows) {
        const subjectType =
          row.taxType?.toLowerCase() === 'pph26'
            ? 'wpln'
            : sanitizeSubjectType(row.subjectType)
        const type: ReceiptTaxType = subjectType === 'wpln' ? 'pph26' : 'pph21'
        const gross = toNumber(row.brutoMonthly)
        if (gross <= 0) continue
        const months = clampMonthsValue(toNumber(row.monthsPaid) || 12)
        const pension = toNumber(row.pensionContribution)
        const bonus = toNumber(row.bonusAnnual)
        const zakat = toNumber(row.zakatOrDonation)
        const scheme = row.scheme === 'lama' ? 'lama' : 'ter'
        const terCategory = (row.terCategory ?? 'A').toUpperCase()
        const ter =
          terCategory === 'A' || terCategory === 'B' || terCategory === 'C'
            ? (terCategory as 'A' | 'B' | 'C')
            : 'A'
        const ptkp = ptkpOptions.includes(row.ptkpStatus ?? '') ? (row.ptkpStatus as string) : 'TK/0'
        const foreignRate = toNumber(row.foreignTaxRate)
        const resultBulk = calculatePph21({
          subjectType,
          brutoMonthly: gross,
          monthsPaid: months,
          pensionContribution: pension,
          zakatOrDonation: zakat,
          ptkpStatus: ptkp,
          scheme,
          terCategory: ter,
          bonusAnnual: bonus,
          foreignTaxRate: foreignRate,
          isDailyWorker: toBoolean(row.isDailyWorker),
        })
        const metricBulk = extractMetrics(resultBulk.breakdown)
        const summaryBulk = {
          totalTax: resultBulk.totalTax,
          ...metricBulk,
        }
        const snapshot = buildSnapshot({
          subjectLabel: t(`pph21.subjectOptions.${subjectType}`),
          brutoMonthly: gross,
          monthsPaid: months,
          pensionContribution: pension,
          bonusAnnual: bonus,
          ptkpStatus: ptkp,
          schemeLabel: t(`pph21.schemeOptions.${scheme}`),
          terCategory: ter,
          zakatOrDonation: zakat,
          foreignTaxRate: foreignRate,
          isDailyWorker: toBoolean(row.isDailyWorker),
        })
        const title = row.recordName?.trim() || t('receipts.bulk.untitled')
        const groupName = row.groupName?.trim()
        const record = saveReceipt({
          title,
          type,
          subjectType,
          summary: summaryBulk,
          breakdown: resultBulk.breakdown,
          formSnapshot: snapshot,
          identifier: row.recordName?.trim(),
          groupName,
          groupId: slugifyGroup(groupName),
          source: 'bulk',
          locale: i18n.language,
        })
        created.push(record)
      }
      if (!created.length) {
        setBulkStatus({ state: 'error', message: t('receipts.bulk.error') })
        return
      }
      const label = rows[0]?.groupName?.trim() || file.name.replace(/\.[^.]+$/, '')
      const batchType =
        created.every((entry) => entry.type === 'pph26') && created.length > 0
          ? 'pph26'
          : created.every((entry) => entry.type === 'pph21')
            ? 'pph21'
            : 'mixed'
      const batch = saveBatch({
        label,
        type: batchType,
        recordIds: created.map((entry) => entry.id),
        fileName: file.name,
        templateVersion: 'v1',
      })
      setBulkStatus({
        state: 'success',
        message: t('receipts.bulk.success', { count: created.length, group: batch.label }),
      })
    } catch (error) {
      console.error(error)
      setBulkStatus({ state: 'error', message: t('receipts.bulk.error') })
    }
  }

  return (
    <>
      <TaxPageLayout
        title={t('pph21.title')}
        description={t('pph21.description')}
        form={
          <TaxFormSection
            title={t('pph21.form.title')}
            description={t('pph21.form.description')}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setForm(createEmptyForm())}
                >
                  {t('app.buttons.clearForm')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(createSampleForm())}
                >
                  {t('app.buttons.useSample')}
                </Button>
              </>
            }
          >
            <FormField label={t('pph21.form.fields.subjectType')} htmlFor="subjectType">
              <Select
                id="subjectType"
                value={form.subjectType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    subjectType: event.target.value as PPh21SubjectType,
                  }))
                }
              >
                {subjectOptions.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={t('pph21.form.fields.brutoMonthly')}
                htmlFor="brutoMonthly"
              >
                <NumberInput
                  id="brutoMonthly"
                  value={form.brutoMonthly}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, brutoMonthly: value }))
                  }
                />
              </FormField>

              <FormField
                label={t('pph21.form.fields.monthsPaid')}
                htmlFor="monthsPaid"
                description={t('pph21.form.descriptions.monthsPaid')}
              >
                <Input
                  id="monthsPaid"
                  type="number"
                  min={1}
                  max={12}
                  value={form.monthsPaid}
                  onChange={(event) =>
                    handleNumberChange('monthsPaid', event.target.value)
                  }
                />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={t('pph21.form.fields.pensionContribution')}
                htmlFor="pensionContribution"
              >
                <NumberInput
                  id="pensionContribution"
                  value={form.pensionContribution}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, pensionContribution: value }))
                  }
                />
              </FormField>
              <FormField
                label={t('pph21.form.fields.bonusAnnual')}
                htmlFor="bonusAnnual"
              >
                <NumberInput
                  id="bonusAnnual"
                  value={form.bonusAnnual}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, bonusAnnual: value }))
                  }
                />
              </FormField>
            </div>

            {form.subjectType !== 'wpln' && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label={t('pph21.form.fields.ptkpStatus')} htmlFor="ptkpStatus">
                    <Select
                      id="ptkpStatus"
                      value={form.ptkpStatus}
                      onChange={(event) =>
                        setForm((prev) => {
                          const nextStatus = event.target.value
                          const nextTer = PTKP_TER_MAPPING[nextStatus]
                          return {
                            ...prev,
                            ptkpStatus: nextStatus,
                            terCategory: nextTer ?? prev.terCategory,
                          }
                        })
                      }
                    >
                      {ptkpOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <FormField
                  label={t('pph21.form.fields.zakat')}
                  htmlFor="zakat"
                  description={t('pph21.form.descriptions.zakat')}
                >
                  <NumberInput
                    id="zakat"
                    value={form.zakatOrDonation}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, zakatOrDonation: value }))
                    }
                  />
                </FormField>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label={t('pph21.form.fields.scheme')} htmlFor="scheme">
                    <Select
                      id="scheme"
                      value={form.scheme}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          scheme: event.target.value as 'lama' | 'ter',
                        }))
                      }
                    >
                      <option value="lama">{t('pph21.schemeOptions.lama')}</option>
                      <option value="ter">{t('pph21.schemeOptions.ter')}</option>
                    </Select>
                  </FormField>

                  <FormField
                    label={t('pph21.form.fields.terCategory')}
                    htmlFor="terCategory"
                    description={t('pph21.form.descriptions.terCategory')}
                  >
                    <Select
                      id="terCategory"
                      value={form.terCategory}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          terCategory: event.target.value as 'A' | 'B' | 'C',
                        }))
                      }
                    >
                      <option value="A">{t('pph21.terOptions.A')}</option>
                      <option value="B">{t('pph21.terOptions.B')}</option>
                      <option value="C">{t('pph21.terOptions.C')}</option>
                    </Select>
                  </FormField>
                </div>
              </>
            )}

            {form.subjectType === 'pegawai_tidak_tetap' && (
              <div className="flex items-center justify-between rounded-2xl border border-[#0f1e3d]/15 bg-[#0f1e3d]/5 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#0f1e3d]">
                    {t('pph21.toggleDaily.title')}
                  </p>
                  <p className="text-xs text-[#0f1e3d]/70">
                    {t('pph21.toggleDaily.description')}
                  </p>
                </div>
                <Button
                  variant={form.isDailyWorker ? 'accent' : 'outline'}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      isDailyWorker: !prev.isDailyWorker,
                    }))
                  }
                >
                  {form.isDailyWorker
                    ? t('pph21.toggleDaily.daily')
                    : t('pph21.toggleDaily.monthly')}
                </Button>
              </div>
            )}

            {form.subjectType === 'wpln' && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label={t('pph21.wplnField.label')}
                  htmlFor="foreignTaxRate"
                  description={t('pph21.wplnField.description')}
                >
                  <Input
                    id="foreignTaxRate"
                    type="number"
                    min={0}
                    max={100}
                    value={form.foreignTaxRate}
                    onChange={(event) =>
                      handleNumberChange('foreignTaxRate', event.target.value)
                    }
                  />
                </FormField>
              </div>
            )}

            {hasError && (
              <p className="text-sm text-red-600">
                {t('errors.positiveOnly', { defaultValue: 'Gunakan angka positif.' })}
              </p>
            )}
          </TaxFormSection>
        }
        summary={
          <TaxSummaryCard
            total={result.totalTax}
            meta={t('pph21.summary.meta')}
            terPerPeriod={terPerPeriod}
            decemberAdjustment={decemberAdjustment}
            takeHomeAnnual={takeHomeAnnual}
            takeHomePerPeriod={takeHomePerPeriod}
          />
        }
        result={<TaxResultTable breakdown={result.breakdown} />}
        explanation={
          <FormulaExplanationCard
            title={t('pph21.explanationTitle')}
            steps={t('pph21.explanation', { returnObjects: true }) as string[]}
          />
        }
        toolbar={
          <ReceiptActionsPanel
            onPreview={openPreview}
            onHistory={() => setHistoryOpen(true)}
            onDownloadTemplate={handleDownloadTemplate}
            onBulkUpload={handleBulkUpload}
            disabled={result.breakdown.length === 0}
          />
        }
        info={
          <InfoAlert
            title={t('pph21.info.goodPractice')}
            items={infoItems}
            extra={
              <p className="text-xs text-[#5a4100]/80">
                {t('pph21.info.disclaimer')}
              </p>
            }
          />
        }
      />

      <ReceiptModal
        open={Boolean(modalData)}
        data={modalData ?? undefined}
        editable={modalMode === 'draft'}
        onClose={closeModal}
        onSave={modalMode === 'draft' ? handleSaveReceipt : undefined}
        onDownloadExcel={modalData ? handleDownloadCurrent : undefined}
        onPrint={modalData ? handlePrintCurrent : undefined}
        onDelete={
          modalMode === 'saved' && selectedReceipt
            ? () => handleDeleteReceipt(selectedReceipt)
            : undefined
        }
      />

      <ReceiptHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        receipts={receipts}
        batches={batches}
        onView={handleViewReceipt}
        onDelete={handleDeleteReceipt}
        onDownloadReceipt={handleDownloadReceipt}
        onPrintReceipt={handlePrintReceipt}
        onDownloadBatch={(batch) => handleDownloadBatch(batch.id)}
        onTemplateDownload={handleDownloadTemplate}
        onBulkUpload={handleBulkUpload}
        bulkStatus={bulkStatus}
      />
    </>
  )
}
const mapRecordToPreview = (
  record: TaxReceipt,
  t: TFunction,
): ReceiptPreviewData => ({
  title: record.title,
  summary: record.summary,
  breakdown: record.breakdown,
  identifier: record.identifier,
  groupName: record.groupName,
  createdAt: record.createdAt,
  locale: record.locale,
  sourceLabel:
    record.source === 'bulk'
      ? t('receipts.modal.source.bulk')
      : t('receipts.modal.source.manual'),
  formSnapshot: record.formSnapshot,
})
