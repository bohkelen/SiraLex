# User Guide

This guide covers the Phase 4.5 dictionary workflow: install a bundle, use it offline, switch dictionaries, update when a new hash is published, and remove bundles you no longer want on the device.

## First-Time Install

1. Open the SiraLex app.
2. Go to the `Dictionary` section.
3. Paste the bundle catalog URL into `Catalog URL`.
4. Click `Load catalog`.
5. In the catalog list, find the dictionary you want.
6. Click `Install`.
7. Wait for the install to complete.

After a successful install, the bundle becomes available on the device and can be used offline.

Example catalog URLs:

- `https://example.org/catalog.json`
- `http://192.168.1.10:8080/catalog.json` for a local Wi-Fi hub

## Search Offline

Once a bundle is installed:

1. Open the app again, even without internet.
2. Go to the `Search` section.
3. Type your query.
4. Use the direction toggle if needed.
5. Open a result to view the entry details.

The search runs against the installed local bundle. Internet access is not required after installation.

## Switching Dictionaries

If more than one bundle is installed:

1. Open the app.
2. Go to `Dictionary`.
3. In the installed dictionaries list, find the bundle you want to activate.
4. Click `Use`.

That bundle becomes the active dictionary for search.

## Updating a Bundle

SiraLex does not auto-update bundles.

When the loaded catalog advertises a different `content_sha256` for an installed bundle, the app shows `Update available`.

To update:

1. Open the app.
2. Go to `Dictionary`.
3. Paste the catalog URL again if needed.
4. Click `Load catalog`.
5. Find the installed bundle marked `Update available`.
6. Click `Update`.

The update is user-triggered. The app stages the replacement safely before switching to the new bundle data.

## Removing a Bundle

To remove a bundle from the device:

1. Open the app.
2. Go to `Dictionary`.
3. Find the installed bundle.
4. Click `Remove`.
5. Confirm the removal.

This deletes the installed bundle data from local storage.

## Manual Import Fallback

If catalog loading is not available, you can still side-load a bundle.

Required files:

- `bundle.manifest.json`
- `records.jsonl`
- `search_index.jsonl`

Manual import steps:

1. Open the app.
2. Go to `Dictionary`.
3. Click `Install bundle files`.
4. Select all three bundle files together.
5. Complete the import.

This fallback matters because real-world connectivity is not guaranteed.

## Credits and sources (offline)

After a dictionary bundle is installed:

1. Open the app (network not required).
2. Go to **More**.
3. Open **Credits & sources**.

The screen shows:

- **Application software license** — MIT OR Apache-2.0 (separate from lexical data).
- **Lexical/data licenses** — per-source entries from the installed bundle manifest (for example Mali-pense / Malidaba **CC BY-NC-SA 4.0**).
- **Attribution text**, source URLs, NonCommercial posture, and ShareAlike notices when present in the bundle.

Credits are read from the installed bundle metadata on the device. No live request to Mali-pense or other source sites is required to display them.

Publication note: a bundle can be compliance-ready without being published in the public catalog. Catalog promotion is a separate, explicit step.
