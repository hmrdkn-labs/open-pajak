// Runs the app's own PPh 21 rules over a fixed set of sample inputs and writes data/pph21-scenarios.json.
// Read-only import of ../../open-pajak-v1/src/lib/tax/pph21.ts. Run: bun scripts/scenarios.ts
// The app needs its dependencies once: cd ../open-pajak-v1 && bun install (node_modules is gitignored).
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculatePph21 } from '../../open-pajak-v1/src/lib/tax/pph21'
import type { PPh21Input } from '../../open-pajak-v1/src/lib/tax/pph21'
import i18n from '../../open-pajak-v1/src/i18n/config'

await i18n.changeLanguage('en')

const GROSS = [5_000_000, 10_000_000, 15_000_000, 25_000_000, 50_000_000]
const PTKP = ['TK/0', 'K/0', 'K/2'] as const
// The app maps each PTKP status to a TER category (PTKP_TER_MAPPING in src/routes/pph21.tsx).
const TER: Record<string, 'A' | 'B' | 'C'> = { 'TK/0': 'A', 'K/0': 'A', 'K/2': 'B' }

const scenarios = GROSS.flatMap((brutoMonthly) =>
  PTKP.map((ptkpStatus) => {
    // Defaults are those of the app's pph21 form: regular employee, TER scheme, twelve periods,
    // no bonus, pension contribution or zakat.
    const input: PPh21Input = {
      subjectType: 'pegawai_tetap',
      brutoMonthly,
      monthsPaid: 12,
      pensionContribution: 0,
      zakatOrDonation: 0,
      ptkpStatus,
      scheme: 'ter',
      terCategory: TER[ptkpStatus],
      bonusAnnual: 0,
      foreignTaxRate: 20,
      isDailyWorker: false,
    }
    const result = calculatePph21(input)
    const row = (id: string) => result.breakdown.find((r) => r.id === id)?.value
    return {
      id: `${brutoMonthly}-${ptkpStatus}`,
      gross: brutoMonthly,
      ptkp: ptkpStatus,
      input,
      monthlyTer: row('ter_per_period'),
      decemberAdjustment: row('december_adjustment'),
      totalTaxYear: result.totalTax,
      rows: result.breakdown,
    }
  }),
)

const out = join(dirname(fileURLToPath(import.meta.url)), '../data/pph21-scenarios.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ source: 'open-pajak-v1/src/lib/tax/pph21.ts', locale: 'en', scenarios }, null, 2) + '\n')
console.log(`wrote ${scenarios.length} scenarios`)
