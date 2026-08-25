# Publication authorization records

Immutable governance events for human publication decisions.

Each file is a single completed authorization event
(`siralex_publication_authorization_record_v1`). Records are append-only:

- no latest-wins mutation
- no inheritance by future release fingerprints
- noncommercial authorization does not imply commercial authorization

Lexical content is never stored here — only identity hashes and decision metadata.
