# Bounded model check of the tax engines: results

Run: `bun run test` from `open-pajak-v1/`, seed `20261126` (`domain.ts`). 86 tests, 6 files, about 25 s.
Every run prints one `[check] <ID> cases=N violations=V first: ...` line per property.

What this verifies: the **engines** in `src/lib/tax/*.ts`, as pure functions, against an oracle
(`oracle.ts`) written from the sources below. What it does **not** verify: the UI wiring (routes, forms,
i18n, receipts, exports). One check reads `routes/pph21.tsx` as text (the status to TER category map).
No engine, constant, UI or i18n file was changed. Fixes are a follow-up that Dika signs off.

## Sources

| Source | Used for |
|---|---|
| `Buku_PPh2126_Release_20240108.pdf` (115 pages; PDF page = printed page) | PPh 21/26: PTKP p.47-48, Pasal 17 p.39, TER Bulanan A/B/C p.40-42, TER Harian p.43, PKP rounding p.32, biaya jabatan p.60, biaya pensiun p.82, worked examples p.62-66, 71-73, 85, 89-93, 97-101, PPh 26 p.110-111 |
| `tax-formulas-mapping.md` (repo) | `roundDown` for TER tax (see PPH21-TER-MASA-FLOOR) |
| Official documents read on 2026-11-26 (URLs in `oracle.ts`, article per row) | PPN, PPh 22, 23, 4(2), PPnBM, see below. Documents were read as enacted; later amendments were not checked unless stated |

| UU 7/2021 Pasal 7(1) and PMK 131/2024 Pasal 2-3 | PPN rates and DPP nilai lain |
| PMK 34/PMK.010/2017 Pasal 2 | PPh 22 |
| UU 36/2008 Pasal 23, PMK 141/PMK.03/2015 Pasal 1 | PPh 23 |
| PP 34/2017 Pasal 4, PP 55/2022 Pasal 56, PP 9/2022 Pasal 3 | PPh 4(2) |
| UU 42/2009 Pasal 7(1), Pasal 8(1) | PPN 10% until 31 Mar 2022, PPnBM range |

PPh 21 rounding the guide is silent on: how many rupiah TER tax is rounded to, and half-rupiah rounding of
biaya jabatan. The annual checks use inputs where 5% is exact; the TER rounding is reported both ways.

## Result per property

VERIFIED = no violation in the stated cases. COUNTEREXAMPLE = first failing input shown. Each counterexample is two tests:
an ordinary test that builds the domain, runs the engine and asserts the case count (so a vacuous run is red), and a
`test.fails` that asserts only "zero tax violations" on that same report.

### Tables (exhaustive)

| ID | Result | Detail |
|---|---|---|
| TABLE-TER-SHAPE | VERIFIED | A 44, B 40, C 41 rows: start at 0%, ceilings strictly increase, no gaps, rates never fall, last row open (guide transcription) |
| TABLE-TER-BULANAN | VERIFIED | `constants.ts` equals the guide, 0 differing rows of 125 (p.40-42) |
| TABLE-PTKP | VERIFIED | 8 statuses equal p.48 |
| TABLE-PASAL17 | VERIFIED | 5 layers equal p.39 |
| TABLE-TER-CATEGORY | VERIFIED | `PTKP_TER_MAPPING` in `routes/pph21.tsx` equals the guide for all 8 statuses (A: TK/0 TK/1 K/0; B: TK/2 TK/3 K/1 K/2; C: K/3) |
| TABLE-PTKP-KI | COUNTEREXAMPLE | p.48 Tabel 7.4 has K/I/0..K/I/3 (112,5 / 117 / 121,5 / 126 jt). The engine has none and `getPTKP` silently falls back to TK/0 for any unknown status |
| TABLE-TER-HARIAN | COUNTEREXAMPLE | 9 of 9 rows differ, see below |

TER Harian, p.43 (one table, no A/B/C): up to Rp450.000 0%, up to Rp2.500.000 0,5%; above Rp2.500.000 a day: Pasal 17 x 50% x bruto (p.89, example p.92).

| Category | `constants.ts` rows (ceiling / rate) | Guide |
|---|---|---|
| A | 750.000 / 0,25%, 2.500.000 / 1,5%, open / 2% | 450.000 / 0%, 2.500.000 / 0,5% |
| B | 750.000 / 0,25%, 2.500.000 / 1,25%, open / 1,75% | same |
| C | 750.000 / 0,25%, 2.500.000 / 1%, open / 1,5% | same |

**PR #17 (`ghozali25`): its TER Harian rows MATCH the guide** (`[450.000, 0%]`, `[2.500.000, 0,5%]`, above: Pasal 17 x 50%; p.43 and p.89).
Probe: the PR's `constants.ts`, `utils.ts`, `pph21.ts` were run against the daily oracle in a throwaway copy:
PPH21-PTT-DAILY-TER 10.000 cases and PPH21-PTT-DAILY-PASAL17 10.000 cases, 0 violations. The probe was not committed.

### PPh 21 (D = 8 statuses x 1.250 bruto values = 10.000 cases unless stated)

Bruto grid: 0, 1, 10^12, every TER ceiling -1/0/+1 of A, B, C, plus seeded log-uniform samples. Annual checks snap bruto to multiples of 20.

| ID | Cases | Result | First failing input / note |
|---|---|---|---|
| PPH21-TER-MASA-NEAREST | 10.000 | VERIFIED | TER masa tax = bruto x rate, rounded half up (the engine's rule), all brackets A/B/C |
| PPH21-TER-MASA-FLOOR | 10.000 | COUNTEREXAMPLE (2.638) | TK/0 bruto 5.495.932: engine 13.740, floor 13.739. The brief and `tax-formulas-mapping.md` say floor; the guide only shows exact values (p.63). **Open question** |
| PPH21-TER-MONOTONE | 10.000 | VERIFIED | more bruto never lowers TER masa tax |
| PPH21-ANNUAL-PKP | 10.000 | VERIFIED | lama, 12 masa: Pasal 17 on floor-to-thousand(neto - PTKP), with bonus and iuran pensiun |
| PPH21-ANNUAL-MONOTONE | 10.000 | VERIFIED | more bruto never lowers annual tax |
| PPH21-DECEMBER-NEAREST | 10.322 | VERIFIED | `december_adjustment` = annual - 11 x masa tax, when not negative |
| PPH21-DECEMBER-FLOOR | 10.322 | COUNTEREXAMPLE (2.107) | same root cause as PPH21-TER-MASA-FLOOR: TK/0 bruto 5.495.920 bonus 37.295.060: engine December 2.053.010, oracle 2.053.021 |
| PPH21-DECEMBER-NEGATIVE | 10.615 (distinct qualifying inputs: 8 statuses x 5.200 snapped bruto values with large zakat, filtered to annual < Jan..Nov withheld) | COUNTEREXAMPLE (all) | What the engine does when annual < Jan..Nov withheld: `adjustment = max(0, difference)`, the excess is shown as `overpaid` but `totalTax` stays at the 11 months withheld. Example TK/0 bruto 5.495.920, zakat 11.940.566: annual 0, engine totalTax 151.140. The guide refunds the excess (p.66 "lebih dipotong", note 1) |
| PPH21-PARTIAL-YEAR | 10.000 | COUNTEREXAMPLE (6.474) | Fewer than 12 masa (guide p.65-66: Dec is the last masa and reconciles). Engine adds `months x TER` and never reconciles; biaya jabatan is capped at Rp6.000.000 instead of Rp500.000 x masa. Worked example p.65-66 (Tuan B, 4 x 15.500.000, TK/0, iuran 100.000): guide 280.000, engine 4.340.000. **Semantics open**: the engine's `monthsPaid` may mean something other than "last masa is December" |
| PPH21-BOUNDS | 80.000 | VERIFIED | 0 <= tax <= bruto, 0 bruto gives 0 tax, all 8 subject types, TER and lama |
| PPH21-NEGATIVE-INPUT | 80.000 | COUNTEREXAMPLE (14.240) | `wpln` and daily `pegawai_tidak_tetap` return negative tax for negative bruto: wpln bruto -3 gives tax -1. The other subject types clamp to 0 |
| PPH21-PENSIUNAN-12 | 10.000 | VERIFIED | biaya pensiun max Rp2.400.000, Pasal 17 on floored PKP (p.82, p.85) |
| PPH21-PENSIUNAN-PARTIAL | 10.000 | COUNTEREXAMPLE (5.750) | cap is a flat 2,4 jt; the guide caps at Rp200.000 x masa (p.82). Root cause also includes the same partial-year semantics as PPH21-PARTIAL-YEAR. TK/0 bruto 5.399.980 months 11: engine 137.454, oracle 159.950 |
| PPH21-PENSIUNAN-TER-MASA | 10.000 | COUNTEREXAMPLE (6.320) | `scheme: 'ter'` is ignored for pensiunan: TK/0 bruto 5.400.001: engine 0, TER 13.500 (p.83-85) |
| PPH21-BUKAN_PEGAWAI | 10.000 | VERIFIED | Pasal 17 on 50% of bruto (p.97-98) |
| PPH21-PESERTA_KEGIATAN, PROGRAM_PENSIUN, MANTAN_PEGAWAI | 10.000 each | VERIFIED | Pasal 17 on the full bruto (p.33) |
| PPH21-WPLN | 10.000 | VERIFIED | 20% of bruto (p.110); P3B rates are not modelled |
| PPH21-PTT-DAILY-TER | 10.000 | COUNTEREXAMPLE (8.904) | daily wage up to 2,5 jt: engine uses the A/B/C tables above. TK/0 wage 200: engine 1, guide 0 |
| PPH21-PTT-DAILY-PASAL17 | 10.000 | COUNTEREXAMPLE (all) | wage above 2,5 jt: engine falls back to 1,5-2%. TK/0 wage 2.500.040: engine 50.001, guide 62.501 (p.89, p.92: 3.000.000 gives 75.000) |
| PPH21-PTT-MONTHLY | 10.000 | COUNTEREXAMPLE (6.633) | paid monthly: guide applies TER Bulanan at any amount (p.89, p.93). The engine switches to 50% x Pasal 17 once bruto > 2,5 jt: TK/0 2.648.471: engine 66.212, guide 0. Semantics open: the form may use that field as a daily rate |

Subject types covered: all 8 in `PPh21SubjectType`. Skipped within them: `pegawai_tidak_tetap` lama (pre-PMK 168 daily rules, p.89), bukan pegawai lama/kumulatif variants (p.97), P3B rates for PPh 26, K/I PTKP. The Rp450.000/Rp2.500.000 thresholds are checked only at +-1 via the grid.

### PPN and PPnBM (10.000 cases per property)

Documents read: UU 7/2021 Pasal 7(1) (11% from 1 Apr 2022, 12% "paling lambat 1 Januari 2025"); PMK 131/2024 Pasal 2(2)-(3), 3(2)-(3), 5, 6 (12% from 1 Jan 2025; Pasal 2 luxury goods: 12% x full DPP; Pasal 3 all other BKP/JKP: 12% x DPP nilai lain = 11/12 of harga jual); UU 42/2009 Pasal 7(1) (10% until the HPP rate) and Pasal 8(1) (PPnBM 10%-200%).

| ID | Result | Note |
|---|---|---|
| PPN-RATE-UI-YEARS | VERIFIED, with scope | 2022-2025 map to 11, 11, 11, 12% on the full DPP. Scope: 2022 is 10% until 31 Mar 2022 (UU 42/2009 Pasal 7(1)), the engine is year-granular. 2025 at 12% on the full DPP matches PMK 131/2024 Pasal 2 (luxury goods) only; for Pasal 3 supplies the effective rate is 11% of the price (open question below) |
| PPN-RATE-2026 | COUNTEREXAMPLE (9.889) | **What happens for 2026:** `PPN_RATES_PER_YEAR` has no `'2026'` key; `ppn.ts:28` falls back to the `'2024'` entry, 11%. The UI offers only 2022-2025 and defaults to `'2024'` (`routes/ppn.tsx:27`). UU 7/2021 Pasal 7(1) huruf b and PMK 131/2024 Pasal 2(2), 3(2) give 12% (no end date in PMK 131/2024). Year 2026 base 13: engine 1, oracle 2 |
| PPN-DPP-PLUS-PPN-IS-TOTAL | VERIFIED | DPP + PPN = total; inclusive total = entered price |
| PPN-ROUND-TRIP | VERIFIED | exclusive then inclusive returns the DPP within Rp1 |
| PPN-NON-POSITIVE | VERIFIED | zero and negative bases owe 0 |
| PPN-CUSTOM-RATE | VERIFIED | `customRate` is a percent |
| PPNBM-RANGE | VERIFIED | all four goods rates lie within 10%-200% (UU 42/2009 Pasal 8(1)). **Each goods rate itself is unverified**: Pasal 8(3) delegates it to a PMK that was not read |
| PPNBM-ROUNDING, PPNBM-CUSTOM-RATE | VERIFIED | arithmetic at the engine's own rates; custom percent against the oracle |
| PPNBM-NEGATIVE | COUNTEREXAMPLE (9.979) | `ppnbm.ts` does not clamp: kendaraanMewah DPP -8 gives tax -1 |

**OPEN TAX QUESTION, not decided here:** PMK 131/2024 DPP nilai lain 11/12. The read text applies 12% to the full price for luxury goods
(Pasal 2) and 12% to 11/12 of the price (11% effective) for the BKP/JKP of Pasal 3, which is not a comprehensive rule: Pasal 4 excludes supplies that use a separately regulated
nilai lain or besaran tertentu, and Pasal 5 has a January 2025 transition for final-consumer luxury goods (1 Jan-31 Jan 2025 on 11/12, from 1 Feb 2025 Pasal 2(2)). The engine has no DPP-nilai-lain switch and no luxury/non-luxury input.
Whether the 2025/2026 default should be 12% on DPP, 11% effective, or a user choice is for Dika. The tests compare against the 12% tarif and mark 2026 as a counterexample;
they do not claim that is the right default. PMK 131/2024 was read as enacted; the later PMK 11/2025 was not read.

### PPh 22, 23, 4(2) (10.000 cases per property)

| ID | Result | Source / note |
|---|---|---|
| PPH22-ORACLE-RATES | VERIFIED as engine arithmetic (sourced rates, nearest-rupiah rounding as the engine does); **not** a regulatory verification of the amount, see next row | impor 2,5%: PMK 34/2017 Pasal 2(1) a.1.d (with API; without API 7,5% huruf e, not modelled). bumn 1,5%: Pasal 2(1) b (buyers of Pasal 1(1) b-e) |
| PPH22-ROUNDING-THOUSAND | COUNTEREXAMPLE (9.684 of 10.000) | PMK 34/PMK.010/2017 Pasal 2(5) (PDF p.10): the levy is "dibulatkan ke bawah dalam ribuan rupiah penuh". The engine rounds to the nearest rupiah. Nilai impor 1.234.567 at 2,5%: engine 30.864, rule 30.000. Oracle `rate(..., 'thousand')`; positive control: an engine flooring to thousands has 0 violations. PMK 34/2017 read as enacted; no amending document was read |
| PPH22 migas, lainnya | UNVERIFIED | `migas` 2%: Pasal 2(1) c lists 0,25% and 0,3% for fuel, gas, lubricants, no 2% row found. `lainnya` 1,5%: names no transaction. Not asserted |
| PPH22-ROUNDING, PPH22-DPP, PPH22-NON-POSITIVE | VERIFIED (engine arithmetic only) | nearest-rupiah rounding as the engine does (not the Pasal 2(5) rule), DPP = max(0, value + other - deduction), non-positive base gives 0 |
| PPH23-ORACLE-RATES | VERIFIED (sourced rows only) | UU 36/2008 Pasal 23(1): jasaTeknik 2% (huruf c angka 2), sewaAlat 2% (c angka 1), dividen 15% (a angka 1), bunga 15% (a angka 2) |
| PPH23-KONSULTAN | COUNTEREXAMPLE (9.974) | `constants.ts` 4%; UU 36/2008 Pasal 23(1) huruf c angka 2 lists "jasa konsultan" at 2%. Base 13: engine 1, 2% gives 0. Read as enacted; later amendments not checked |
| PPH23-ROUNDING, FINAL-FLAG, NON-POSITIVE | VERIFIED | `isFinal` only changes the note |
| PPH4_2-ORACLE-RATES | VERIFIED (sourced rows only) | sewaTanah 10%: PP 34/2017 Pasal 4(1). umkmFinal 0,5%: PP 55/2022 Pasal 56(2) (time limits and Rp500 juta threshold of Pasal 57-59 not modelled) |
| PPH4_2-KONSTRUKSI | VERIFIED (membership) | rate depends on provider class, PP 9/2022 Pasal 3(1) a-g: 1,75 / 4 / 2,65 / 2,65 / 4 / 3,5 / 6%. The engine's 3,5% is huruf f (konsultansi konstruksi with a sertifikat). Only membership in the legal set is asserted; the engine cannot choose a class |
| PPH4_2 restoran | UNVERIFIED | 5%: no document read supports a PPh 4(2) rate for restoran. Not asserted |
| PPH4_2-ROUNDING, NON-POSITIVE | VERIFIED | |

Not modelled by the engines (documented gaps, not counterexamples of a rate):

- Higher rate (+100%) for a buyer or withholdee without NPWP: PMK 34/2017 Pasal 2(4) (PPh 22), UU 36/2008 Pasal 23(1a) and PMK 141/PMK.03/2015 Pasal 1(7) (PPh 23). No input for it.
- PPh 22 import without API (7,5%), other import classes (10%, 0,5%).
- The lama scheme deducts zakat too, though the guide's lama formula (p.61) lists none; the checks use zero zakat in lama.
- Sub-rupiah rounding of biaya jabatan (5% of an odd bruto): the guide is silent; avoided by snapping inputs.

## Coverage narrowed by orchestrator 2026-11-26, needs a later brief

Exactly this coverage was not completed. The orchestrator approved leaving it unverified; it is not a pass:

- every PPnBM goods rate (`kendaraanMewah` 20%, `perhiasan` 30%, `kapalPesiar` 75%, `elektronikPremium` 25%): only the UU 42/2009 Pasal 8(1) range of 10%-200% is asserted; the PMK under Pasal 8(3) was not read;
- PPh 22 `migas` (2%) and `lainnya` (1,5%): not asserted;
- PPh 4(2) `restoran` (5%): not asserted.

## Negative controls

Each mutant runs the same property as the baseline, on a mutated module loaded with `vi.doMock`. The baseline passes that property; each mutant must fail it.

| Mutant | Property | Violations |
|---|---|---|
| PPH21 TER A row 6 ceiling +Rp1 | TER-MASA-NEAREST | 3 (rejected) |
| PPH21 PKP not floored to thousands | ANNUAL-PKP | 6.254 |
| PPH21 PTKP K/1 +Rp1.000 | ANNUAL-PKP | 822 |
| PPN 2025 rate left at 11% | RATE-UI-YEARS | 2.429 |
| PPN exclusive tax truncated | RATE-UI-YEARS | 2.441 |
| PPnBM tax truncated | ROUNDING | 4.566 |
| PPnBM rate scale off by ten | ROUNDING | 9.996 |
| PPh 22 tax truncated | ROUNDING | 4.802 |
| PPh 22 impor rate 2,0% | ORACLE-RATES | 4.905 |
| PPh 23 tax truncated | ROUNDING | 4.637 |
| PPh 23 dividen rate 10% | ORACLE-RATES | 2.489 |
| PPh 4(2) tax truncated | ROUNDING | 4.784 |
| PPh 4(2) umkmFinal rate 1% | ORACLE-RATES | 4.909 |

All 13 rejected. Positive control: an engine rounding PPh 22 down to thousands satisfies PPH22-ROUNDING-THOUSAND (0 violations), so the thousand oracle is implemented as the regulation states. The weakest is the TER row shift (3 violations): only categories A statuses hit the shifted row, and only at ceiling+1.
