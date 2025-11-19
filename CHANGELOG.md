# Change Log

All notable changes to the "reactive-themes" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.3.0] - 2025-11-19

### Added
- Context-aware rule evaluation: debug sessions (including debug type), test state transitions, timer-based triggers, and diff/merge view detection.
- Rule linting and cleanup utilities to detect duplicates, unreachable rules, invalid languages/themes, and overlaps.
- Rule testing and explanation commands (`Test Rule`, `Explain Current Theme`, and copy-to-clipboard support) to preview and diagnose theme selection.
- Theme catalog lookup for validation and prompts, plus shared UI helpers for commands.
- Integration test coverage and shared test utilities for rule evaluation and trigger behavior.

### Changed
- Consolidated rule engine, overlap detection, and linter logic for consistency across commands.
- Refined extension initialization, context managers, and configuration handling (including safer concurrent writes).
