---
name: refactor
description: Refactor code by extracting components, hooks, or utilities. Use when code needs restructuring without changing functionality.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Code Refactoring

## Instructions

When refactoring code:

1. **Read first**: Understand the full context before changing anything. Read the file and its imports/dependents.

2. **Common refactoring patterns**:

   **Extract component**: When JSX is too long or repeated:
   - Move to a new file in the same directory or `components/`
   - Pass only the props it needs
   - Keep it as a Server Component if it doesn't need interactivity

   **Extract hook**: When stateful logic is repeated or a component is too complex:
   - Move to `hooks/use-hook-name.ts`
   - Return a clean API

   **Extract utility**: When pure logic is repeated:
   - Move to `lib/` or `utils/`
   - Make it a pure function with types

   **Simplify conditionals**: Replace nested if/else with early returns, guard clauses, or lookup objects.

   **Reduce prop drilling**: Use React Context, composition (children prop), or server-side data fetching.

3. **Rules**:
   - Make one logical change at a time
   - Preserve existing behavior — refactoring should not change functionality
   - Run tests after refactoring to verify nothing broke: `npx vitest run`
   - Run `npx tsc --noEmit` to check types
   - Don't refactor and add features in the same step

4. **When NOT to refactor**:
   - Code that works and won't be changed again
   - During an active bug investigation (fix first, refactor later)
   - Without tests to verify behavior is preserved