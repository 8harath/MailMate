# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Restructured the repository so the application lives at the root (previously nested under `submissions/61-Avalon/`).
- Rebranded the package to `mailmate` and removed hackathon-specific framing and documents.
- Reworked the landing page to remove unverifiable marketing claims, placeholder pricing, and dead links.

### Added
- Production tooling: GitHub Actions CI (lint, typecheck, test, build), issue/PR templates, `Dockerfile`, `.editorconfig`, `.nvmrc`.
- Request-body validation across API routes via Zod schemas (`lib/validation.ts`).
- A shared logger (`lib/logger.ts`) and explicit success/failure results from the persistence layer.
- Documentation: rewritten `README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.

### Fixed
- The `lint` script, which previously referenced ESLint with no configuration present.

## [0.1.0]

- Initial MailMate application: Gmail + Google Calendar integration, Groq-powered
  thread analysis, AI writing tools, multi-agent coordinator, approval-gated
  automation, and optional Supabase persistence.

[Unreleased]: https://github.com/8harath/MailMate/compare/main...HEAD
