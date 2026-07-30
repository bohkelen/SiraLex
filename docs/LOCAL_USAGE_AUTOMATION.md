# Local Usage Automation

This document explains the local browser harness that simulates a small diagnostic cohort using the SiraLex web app.

The harness is for structured usability evidence only. It does not recruit users, does not create demand signals, and does not authorize dictionary/search interventions.

## What It Answers

The Playwright run checks whether a local user flow can:

- open the app and install the featured dictionary,
- choose search direction,
- run French-to-Maninka and Maninka-to-French searches,
- observe hits, misses, retries, and phrase-like behavior,
- reopen offline and search again,
- produce a compact review table.

It intentionally does not answer how often real people search for a term.

## Evidence Boundary

Scripted rows are always emitted with:

```text
session_type = structured_usability
consent = not_applicable
can_influence_demand = false
human_disposition = pending_owner_review
```

The generated artifacts are review aids. They must not be treated as natural-use logs, raw demand, aliases to add, source-index supplements to add, or dictionary entries to create.

Only opt-in natural-use exports from real testers can influence future demand ranking, and only after manual review.

## Run Locally

From `web/`:

```bash
npm install
npx playwright install chromium
npm run test:e2e:usage
```

By default, the command uses the small checked-in debug bundle at `web/public/debug-bundles/test_directional_bundle`. This keeps the local automation fast enough to run during development. The generated rows still represent structured usability smoke evidence, not demand evidence.

To run the same harness against the featured 7N2B three-file bundle (`bundle_full_20260710_337619ff`) with a longer install timeout:

```bash
npm run test:e2e:usage:featured
```

This opt-in script sets `SIRALEX_USAGE_BUNDLE_DIR` to `public/bundle_full_20260710_337619ff` and `SIRALEX_USAGE_INSTALL_TIMEOUT_MS=900000` (full three-file import is much slower than the debug fixture). It does not change the debug default. Output remains structured usability evidence only, not lexical validation or demand evidence.

To run the same harness against another three-file bundle directory:

```bash
SIRALEX_USAGE_BUNDLE_DIR=/absolute/path/to/bundle_dir npm run test:e2e:usage
```

To validate a recorded candidate package instead of the remote featured catalog path, pass the package file explicitly:

```bash
SIRALEX_USAGE_PACKAGE=/absolute/path/to/bundle_full_....siralex.zip npm run test:e2e:usage
```

This is the preferred route for package-candidate validation because it exercises the integrity-checked `.siralex.zip` transport envelope without depending on a large browser fetch from the local catalog route. Full candidate packages are much larger than the debug fixture; set `SIRALEX_USAGE_INSTALL_TIMEOUT_MS` if you expect a long browser import.

For a visible browser:

```bash
npm run test:e2e:usage:headed
```

The Playwright config builds the app and serves it with `npm run preview` before running the cohort.

## Output

Local artifacts are written under:

```text
data/local_evidence/human_usage_automation/<run_id>/
```

The project `.gitignore` excludes `data/`, so these outputs stay local unless explicitly reviewed and moved under a governed evidence path.

Each run writes:

- `structured_usability_evidence.jsonl` — one structured row per query attempt,
- `structured_usability_evidence.md` — compact evidence table,
- `run_summary.json` — row count and evidence-scope summary.

The table follows this shape:

```text
query / user intention
→ search direction
→ observed result
→ issue class
→ recurrence
→ user impact
→ candidate intervention category
→ human disposition
```

## Cohort Model

The cohort is encoded in `web/e2e/human_usage/personas.ts`:

- `G1` to `G5`: Guinea diagnostic archetypes,
- `N1` to `N5`: North America diagnostic archetypes.

Each persona receives the same six scenario-card categories:

```text
1. Find a word about family.
2. Find a word about food, the market, or daily life.
3. Find a word about the body, health, or care.
4. Search for a Maninka word you already know.
5. Search for a short phrase you might naturally say.
6. Turn off internet, reopen the app, and search again.
```

Some rows include moderator-only probes, such as Unicode normalization checks. Those rows are marked `probe_or_test` and cannot be promoted as user demand.

## Human Review

The harness can observe UI state and result counts. It cannot decide whether a Maninka result is semantically useful.

Use the generated table to fill in final human disposition:

```text
approve_for_follow_up
reject_not_actionable
needs_more_natural_use_evidence
needs_bundle_content_check
needs_index_check
```

Keep raw natural-use JSONL exports outside git. If a real tester consents to share logs, process them with the existing validation workflow first, then attach manual annotations before any prioritization decision.
