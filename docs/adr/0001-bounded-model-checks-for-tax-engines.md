# 1. Bounded model checks for the tax engines

Date: 2026-11-26
Status: accepted (Dika, 2026-11-26)

## Context

Open Pajak is a public calculator that people use for real withholding amounts. The engines in
`open-pajak-v1/src/lib/tax/` are pure functions, but the repo had no tests at all. Hand-written example tests
would pin the engines' own numbers, so they cannot tell a wrong rate or a wrong rounding rule from a right one.

## Decision

Check every engine with bounded model checks that run as Vitest tests (`bun run test`):

- An independent oracle (`src/lib/tax/check/oracle.ts`) is transcribed from the official sources, with the
  PDF page or regulation cited per table. It is never copied from `constants.ts`.
- Properties run over at least 10.000 deterministic cases each: an edge grid (0, 1, every bracket bound
  -1/0/+1, 10^12) plus seeded samples (mulberry32, `check/domain.ts`).
- Negative controls: each engine file has two mutants (shifted TER row, missing floor, wrong rate, truncated
  rounding) loaded with `vi.doMock`. A mutant that passes means the oracle is too weak and must be strengthened.
- Findings that disagree with the sources are kept as `test.fails` with a pointer to
  `src/lib/tax/check/RESULTS.md`, so the suite stays green and honest. Fixing an engine means removing its
  `test.fails` in the same change, after a tax sign-off.
- The checks cover the engines only, not the UI wiring.

## Consequences

- Any change to a tax number or rounding rule must keep the oracle in agreement or update it with a cited source.
- Oracle rows from regulations (PPN, PPh 22/23/4(2)) carry a confidence flag; rows marked `dika-to-confirm`
  need tax review before an engine fix.
- The suite takes about 25 s. CI runs it on every push and pull request (`.github/workflows/test.yml`).
