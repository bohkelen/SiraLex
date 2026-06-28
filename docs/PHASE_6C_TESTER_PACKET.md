# Phase 6C Tester Packet

Purpose: test whether the improved consumer surface is now self-serve, and whether remaining friction is search/content-related rather than setup-related.

Do not commit tester query-log exports or raw personal feedback. Keep exported logs outside the repo unless a reviewed anonymized fixture is explicitly approved.

## App Link

Use this exact link when sending the packet:

`APP_LINK_REQUIRED_BEFORE_SENDING`

Replace the value above with the confirmed deployed app URL before sending this packet to testers.

## Tester Script

### Returning Testers

Use this for testers who saw the earlier, more technical version.

Message:

> I made changes to make SiraLex easier to use without explanation.
>
> Please open: `APP_LINK_REQUIRED_BEFORE_SENDING`
>
> Try it as if I am not available to help. Please do these tasks:
>
> 1. Open the app.
> 2. Add the featured dictionary if the app asks you to.
> 3. Search for a few French words you would expect in a French-Maninka dictionary.
> 4. Switch direction and search for any Maninka words you know or can copy from results.
> 5. Try one short phrase, not just single words.
>
> Please tell me where you hesitated, what felt unclear, and which searches did not behave the way you expected.

Do not explain:

- what a catalog is
- what a bundle is
- where Advanced setup is unless they get blocked
- how search normalization works
- which search direction to choose before they try
- where diagnostics are unless they agree to export logs afterward

### Fresh Users

Use this for people who have not seen SiraLex, with almost no guidance.

Message:

> Can you try this dictionary app for a few minutes?
>
> Open: `APP_LINK_REQUIRED_BEFORE_SENDING`
>
> Without me explaining it, please try to:
>
> 1. Understand what the app is for.
> 2. Add the dictionary if needed.
> 3. Search for a French word.
> 4. Search in the other direction.
> 5. Try a phrase or expression you might naturally look up.
>
> Afterward I will ask a few questions. If anything is confusing, please do not worry; that is exactly what I am testing.

Do not explain:

- that this is an offline-first app
- catalog, bundle, manifest, import, normalization, or diagnostics language
- what the correct first button is
- that the interface is supposed to be French-first
- what kind of search should work
- how to recover unless they are fully blocked

## After-Test Questions

Ask these immediately after each session.

1. Did the link open successfully?
2. Before adding anything, did you understand what the app was?
3. Were you able to add the dictionary without help?
4. Did you find search immediately after the dictionary was added?
5. Did the French interface feel natural? Which words or labels felt strange?
6. Was the search direction understandable?
7. What searches did you try?
8. Which searches missed or gave confusing results?
9. Did any result content feel wrong, incomplete, or hard to interpret?
10. Did you see any technical language or settings that felt confusing?
11. Did you use the app on phone or computer? Which browser?
12. Would you be willing to export local query logs from this test?

## Query-Log Export Request

Only ask this after the tester agrees. Query logs are local to their device and should be treated as tester-provided data.

Message:

> Thank you. If you are willing, please export the local query logs from this test:
>
> 1. Open the SiraLex app again.
> 2. Open **Advanced diagnostics**.
> 3. If query logging is off, turn it on before doing more searches.
> 4. Press **Export logs**.
> 5. Send me the downloaded `.jsonl` file.
>
> Please only send the file if you are comfortable sharing the exact searches you typed. Do not edit the file manually.

If the tester had logging off during the session, ask them to turn it on, repeat a few representative searches, then export.

## Feedback Intake Template

Use one copy per tester.

```text
Tester label:
Returning tester or fresh user:
Date:
Device/browser:
App link used:

Access worked? yes/no
Understood what the app was before guidance? yes/no/partial
Added dictionary without help? yes/no/partial
Found search immediately after install? yes/no/partial
French UI natural? yes/no/partial
French UI notes:
Search direction intuitive? yes/no/partial
Direction notes:

Searches attempted:
- 

Misses or confusing results:
- Query:
  Direction:
  What happened:
  What they expected:

Content that felt wrong, incomplete, or hard to interpret:
- 

Remaining technical language or confusing settings:
- 

Query logs exported? yes/no
Query-log filename:
Follow-up needed:
```

## Analysis Handoff

When query-log exports arrive:

1. Store them outside the repo.
2. Run `python3 scripts/analyze_query_logs.py <export.jsonl> --format markdown`.
3. Manually classify candidate misses with one of:
   - `phrase_mismatch`
   - `missing_entry`
   - `index_gap`
   - `language_mismatch`
   - `spelling_error`
4. Compare the log summary with the feedback template before deciding whether the next fix belongs to UX copy, search behavior, or content.
