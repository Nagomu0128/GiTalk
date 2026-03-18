# CLAUDE.md

## Pre-Implementation Checklist

- Before starting any implementation, always review the requirement specifications under `docs/specs/`.
- In particular, check `docs/specs/10-task-dependencies.md` to understand task dependencies and ensure implementation proceeds in the correct order.

## Coding Rules

- When writing code, always follow the skill defined in `.claude/skills/coding-rules/SKILL.md`.

## Work Logs

- Each time you make implementation progress, create a work log file under `docs/logs/` to record errors and progress in detail.
- Name files with a sequential number and a brief task summary (e.g., `docs/logs/001-change-document`).

## Branch Strategy

- **Never develop directly on the main branch.**
- Before starting work on a new feature, always execute the `/create-branch` skill to commit, push, and create a new branch.
