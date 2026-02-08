"""
Search index builder for Nkokan.

Reads normalized JSONL and produces a materialized inverted index:
(key_type, key) → [ir_id, ...].

This is a read-only build step — it never mutates normalized records or IR.
"""
