# Data Access And NDA Guidance

This document explains what data is appropriate to share from this repository and what must not be uploaded or distributed without explicit approval.

## Summary

This repository contains code, schema definitions, mock/sample structures, and local-development artifacts for the Morning Blotter analytics platform. It must not be used as a dumping ground for confidential sponsor raw data unless all of the following are true:

- the sponsor has explicitly approved the upload
- the repository is private
- the upload complies with the applicable NDA, EPA, data-use agreement, and internal policy

## Safe To Share In Most Internal Engineering Contexts

The following are usually shareable inside an approved internal engineering or academic handoff context, subject to the governing agreement:

- application source code in `src/` and `backend/`
- dependency manifests such as `package.json` and `requirements.txt`
- generated or synthetic mock data structures that do not reveal sponsor-confidential records
- schema definitions in `db/schema.sql`
- documentation, architecture notes, and API notes
- sanitized screenshots or redacted result examples
- derived metrics only if they cannot be reverse-engineered into confidential sponsor records

## Do Not Upload Without Explicit Sponsor Permission

The following must not be committed or shared unless the sponsor has expressly permitted it and the repository/privacy controls are appropriate:

- raw sponsor trade files
- sponsor-provided extracts or exports
- confidential counterparty lists
- non-public identifiers tied to real institutions or accounts
- sponsor-specific trader or desk mappings
- confidential model outputs that can reveal trading behavior
- production credentials, tokens, or secret environment files
- unredacted logs that may contain sensitive prompts, data payloads, or outputs

## Database Guidance

The repository currently includes database-oriented assets for local development and experimentation. Before external delivery or broader sharing, verify that:

- the SQLite database file does not contain confidential sponsor raw data
- any included records are synthetic, approved sample data, or otherwise NDA-compliant
- local environment files containing secrets are excluded or redacted

## AI And Prompt Data Guidance

Because this project includes AI-assisted analytics:

- do not include sponsor-confidential prompts or prompt logs unless approved
- do not upload generated AI outputs if they reveal confidential trading activity
- do not commit credential files such as live Bedrock secrets

## Recommended Sharing Practice

For handoff or submission, prefer this order of sharing:

1. code and docs
2. schema and synthetic examples
3. sanitized screenshots or approved sample outputs
4. only then any sponsor-linked derived artifacts, and only if explicitly authorized

## Required Review Before Release

Before sharing the repository outside the immediate project team, confirm with the designated project owner or NDA/compliance contact:

- whether the repository is private
- whether any data artifact is sponsor-owned
- whether any result file could disclose sensitive trade information
- whether the upload complies with the EPA/NDA terms
