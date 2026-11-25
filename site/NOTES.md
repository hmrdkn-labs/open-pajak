# Site notes

Two pages from one template: `/` is Indonesian (`src/i18n/id.json`), `/en/` is English (`src/i18n/en.json`), rendered by `scripts/build.mjs`. Search decisions are in `~/workspace/sandbox/showcase-scan/build/v3/open-pajak/SEO.md`.

## Logo provenance

`src/logo.svg` (also `src/favicon.svg`, `src/apple-touch-icon.png`, the header mark and the mark in `og.png`/`og-id.png`) is the project's "OP" mark from `open-pajak-v1/public/favicon.svg` (96x96, rect rx 22 `#0F1E3D`, "O" `#FFFFFF` at x 22, "P" `#F9C74F` at x 48, baseline y 62, Inter 700 at 44 px). `scripts/logo.mjs` outlines both letters from Inter Bold (`@fontsource/inter` `inter-latin-700-normal.woff`, SIL OFL) with `opentype.js`, so the page needs no Inter. A render of the outlined file matched the original SVG rendered with Inter loaded, with 0 differing pixels at 768 px (pixelmatch, threshold 0.1). The apple touch icon is the same mark on a full-bleed `#0F1E3D` square, because iOS rounds the corners itself.

## Image provenance

All three are illustrations made with `generate_image` (gpt-image-2 via openai-codex) on 2026-11-25. None is a screenshot or real data. Originals are in `src/img/`; `scripts/images.sh` derives the shipped AVIF and WebP files.

| File | Tool | Prompt used | Date | Aspect (generated, shown) | Where used |
|---|---|---|---|---|---|
| `src/img/hero-forms.png` | generate_image | Top-down view of a fanned stack of blank Indonesian tax forms, a payslip and a calculator on a deep navy desk, cool daylight, crisp shadows. Paper is cool white with blue-grey ruled lines and one gold paper clip. No legible text or numbers. Style: clean editorial still life illustration, navy #0a2540 and gold #f6b800 palette. | 2026-11-25 | 3:2 (tool has no 16:9 output), cropped to 16:9 and then to the stage ratio in CSS | Hero stage; also the OG image |
| `src/img/receipts-export.png` | generate_image | A printed tax receipt sheet and a spreadsheet printout clipped together beside a closed laptop on a cool white desk, cool daylight, navy and gold accents. No legible text. Style: clean editorial still life illustration, navy and gold palette, top-down. | 2026-11-25 | 2:3 (tool has no 4:5), cropped to 4:5 in CSS | Your numbers stay on your device |
| `src/img/handbook.webp` | generate_image | An open reference handbook with cool white pages with blue-grey ruled lines (no cream or yellow paper), blue-grey index tabs and a gold ribbon bookmark, lying on a deep navy surface, cool daylight, top-down. No legible text. Style: clean editorial still life illustration, navy and gold palette, cool neutral whites only. (First attempt had cream pages and was discarded.) | 2026-11-25 | 3:2, shown 3:2 | Rules that come from DJP's own book |

## Claims

| # | Claim (page text) | Source | How a reader checks it | Status |
|---|---|---|---|---|
| 1 | Calculators for PPh 21, 22, 23, 26, 4(2), PPN, PPNBM; six calculators | `README.md` Key Capabilities; routes in `open-pajak-v1/src/routes/` | Live routes on openpajak.hamardikan.com | OK |
| 2 | Row descriptions in the list | App's own English strings, `open-pajak-v1/src/i18n/locales/en/common.json` (`home.calculatorList.cards`) | Same file | OK |
| 3 | Every step is shown; step-by-step table and formula narrative | README "Calculation transparency"; `en/common.json` | Open any calculator | OK |
| 4 | Numbers stay in the browser; no backend; no NIK, names or addresses | README intro; app home hero and privacy text in `en/common.json` | README; no backend code in `open-pajak-v1/` (`worker/_worker.js` is 597 bytes, not read for logic) | OK, wording follows the README |
| 5 | Receipts in local storage; Excel and PDF export; bulk Excel upload offline | README Recent Highlights; `open-pajak-v1/src/lib/storage/receipts.ts` | README | OK |
| 6 | Ledger figures, both languages | `scripts/scenarios.ts` runs `open-pajak-v1/src/lib/tax/pph21.ts` once per locale; output `data/pph21-scenarios.en.json` and `data/pph21-scenarios.id.json` (15 cases each, identical figures); the build only formats them (`Rp 15.000.000` on `/`, `Rp 15,000,000` on `/en/`); no figure typed by hand | `bun scripts/scenarios.ts` | OK |
| 7 | Ledger inputs: employee, TER, 12 months, no bonus, pension or zakat; TER category follows PTKP status | `PPh21Input`; `PTKP_TER_MAPPING` in `src/routes/pph21.tsx` | Same files | OK |
| 8 | Default case Rp 15,000,000 with K/0 | `createSampleForm` in `src/routes/pph21.tsx` | Same file | OK |
| 9 | TK/0, K/0, K/2 descriptions (single, married, dependants) | PTKP code naming in `src/lib/tax/constants.ts` | Same file | OK |
| 10 | Buku PPh 21/26, DJP, release 8 January 2024 | README; `FormulaSourceNote.tsx`; PDF name `Buku_PPh2126_Release_20240108.pdf` | The PDF link on the page (HTTP 200 on 2026-11-25) | OK |
| 11 | 53 stars, 13 forks, last push 2 November 2026, counted on 25 November 2026 | `data/github.json` from `scripts/snapshot.sh` (gh API) | Repository page | OK, dated |
| 12 | Code is public to read; no licence granted | gh `license` null; no LICENSE file; README "provided as-is" | Repository page | OK |
| 13 | Maintainer and credited contributors | README "Community & Contributors" | README | OK |
| 14 | Disclaimer sentence | README License section, verbatim | README | OK |
| 15 | Not claimed: tests, traffic numbers, licence offer, rate legal bases | PLAYBOOK §2; card `open-pajak.md` | n/a | Left out on purpose |
| 16 | Indonesian page copy: same facts as claims 1 to 14, written in Indonesian | Tax names and terms from the app's `open-pajak-v1/src/i18n/locales/id/common.json`: calculator card titles and descriptions (`home.calculatorList.cards`), "Pegawai tetap", "Tarif Efektif (TER)", "Status PTKP", "bukti", "Penghasilan netto", row labels in the ledger (written by the app in `id`) | Same file | OK |
| 17 | Indonesian "Tabel ini untuk satu pegawai tetap ... dua belas masa tanpa bonus" | Same inputs as claim 7 (`PPh21Input`: `subjectType: pegawai_tetap`, `monthsPaid: 12`, `bonusAnnual: 0`) | `scripts/scenarios.ts` | OK |
| 18 | Indonesian disclaimer "Konsultasikan dengan konsultan pajak profesional ..." | Translation of the README License sentence of claim 14 | README | OK, translated |
| 19 | Search description, JSON-LD (`WebApplication`: category, OS, `sameAs` repo, author) | `build/v3/open-pajak/SEO.md`; repository URL; maintainer name from the README | Page source | OK, no rating, offer or version claimed |
