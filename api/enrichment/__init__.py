"""
Record enrichment for Nkokan offline bundles.

Joins normalized records (search metadata) with IR records (display fields)
to produce self-contained enriched records suitable for offline dictionary use.

This is a read-only build step — it never mutates normalized records or IR.
The `display` field is a shallow, read-only projection of IR `fields_raw`.
"""
