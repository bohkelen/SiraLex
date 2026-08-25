# Publication authorization record v1

Immutable governance schema for completed SiraLex publication authorizations.

## Purpose

Prove from tracked Git state:

- who authorized a publication
- which exact release artifact was authorized
- which distributed file hashes were bound
- that authorization was noncommercial (or not)
- when and how it was authorized
- which rollback target existed at publication time

## Non-goals

- Mutable current-status rows
- Automatic inheritance by later release fingerprints
- Storing lexical payload bytes
- Replacing catalog or bundle package schemas

## Schema

`schema_version`: `siralex_publication_authorization_record_v1`

Required fields include `authorization_id` (deterministic from release fingerprint +
decision evidence), `release_artifact_fingerprint`, `distributed_file_hashes`,
`publication_decision`, `reviewer_id`, `reviewed_at`, `review_method`,
`publication_profile`, `commercial_authorization`, and `rollback_target`.

## Location

`shared/publication_authorizations/<authorization_id>.json`
