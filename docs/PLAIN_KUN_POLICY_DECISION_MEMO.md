# Plain `Kun` Policy Decision Memo

Status: decision memo only. Do not implement before Phase 6C logs show whether users commonly type accentless Maninka forms and miss expected results.

## Context

The `norm_v3` rollout fixed Unicode-equivalent target queries:

- `Kùn` works.
- decomposed `kùn` works.
- plain `Kun` currently resolves only to the unaccented meaning.

That behavior is consistent with the current first-hit exactness ladder:

1. `casefold`
2. `diacritics_insensitive`
3. `punct_stripped`
4. `nospace`

The runtime stops at the first non-empty level and does not merge lower-ladder results into a higher-ladder hit. This keeps query behavior deterministic and avoids broad recall changes hidden in the client.

## Decision To Make

Should plain accentless target-side queries such as `Kun` broaden to include accented Maninka forms such as `Kùn` when an unaccented exact target form also exists?

## Option 1: Keep Deterministic Exactness Doctrine Unchanged

Behavior:

- `Kun` keeps returning the exact unaccented target-side result.
- `Kùn` and decomposed `kùn` keep returning the accented result.
- No runtime merging across ladder levels.

Pros:

- Preserves the current first-hit doctrine.
- Minimizes regressions in result precision.
- Keeps runtime behavior easy to explain and test.
- Avoids making tone/diacritic distinctions invisible.

Cons:

- Users who type without accents may miss accented forms they intended.
- Search may feel less forgiving for users with keyboards that make diacritics hard.
- The policy may be hard to explain to nontechnical users if accentless typing is common.

Best fit if:

- Phase 6C logs show few accentless target-side misses.
- Users mostly search French to Maninka, copy Maninka forms from results, or use N'Ko.
- Maintaining precision is more important than accentless recall.

## Option 2: Broaden Accentless Target-Side Queries In A Controlled Way

Behavior:

- For target-side queries only, a plain accentless input can include accented forms from the diacritics-insensitive key even if an exact unaccented target form exists.
- Broadening should be explicit, tested, and limited to a clearly defined target-side policy.

Pros:

- Better recall for users who cannot or do not type Maninka diacritics.
- Matches common user expectations that accentless Latin input is "close enough."
- Could reduce false misses without changing source-side French lookup.

Cons:

- Breaks the simple first-hit doctrine for one class of query.
- Can mix distinct lexical forms that differ by tone or orthography.
- Requires careful result presentation so users know exact and broadened matches are different.
- Increases test matrix complexity.

Best fit if:

- Phase 6C logs show repeated accentless target-side queries that users consider misses.
- Testers report keyboard/access friction around Maninka diacritics.
- The UI can distinguish exact matches from broadened matches if needed.

## Option 3: Move Recall Intelligence Into Bundle/Index Policy

Behavior:

- Keep runtime lookup deterministic.
- Encode any broadened accentless recall in generated bundle/index artifacts, using versioned index policy rather than ad hoc client merging.
- A future ruleset could materialize policy-specific keys or result groups while preserving a simple runtime contract.

Pros:

- Keeps the client simple and offline-friendly.
- Makes linguistic/search policy versioned with the bundle.
- Allows different bundles or language pairs to choose different recall policies.
- Creates a cleaner audit trail for why a query returns a broader set.

Cons:

- Requires pipeline/index work rather than a small runtime patch.
- Needs a clear versioned policy design before implementation.
- Still requires product decisions about how to present exact vs broadened matches.

Best fit if:

- Accentless recall becomes a real user need, but the project wants to preserve deterministic runtime semantics.
- Similar issues appear beyond `Kun`, suggesting a general bundle-policy problem.
- Future language pairs may need different accent/orthography policies.

## Recommendation For Now

Do not implement yet.

Use Phase 6C query logs to answer:

- How often do users type target-side Latin Maninka without accents?
- Do those queries repeat across testers or appear only in isolated cases?
- Do users describe the result as wrong/missing, or do they accept the exact unaccented result?
- Are the misses concentrated around a few common words or broad across the lexicon?

Until those logs arrive, keep the current doctrine unchanged and treat plain `Kun` as an isolated policy question, not a `norm_v3` defect.
