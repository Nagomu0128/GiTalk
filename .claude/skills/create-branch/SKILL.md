---
name: create-branch
description: Create a new Git branch for feature development. Use when starting a new feature, fix, or any scoped unit of work. Ensures changes are committed and pushed before branching off main.
user-invocable: true
allowed-tools: Bash
---

# Create Branch

Manages branch creation for new feature development. Ensures all current changes are committed and pushed before starting work on a new branch. This skill should be invoked whenever starting a new feature, fix, or any scoped unit of work.

## Instructions

When starting new feature development or any new unit of work:

1. **Check current branch**: Verify which branch you are currently on.
   ```bash
   git branch --show-current
   ```

2. **CRITICAL — Never develop on main**: If the current branch is `main`, you **must** create a new branch before writing any code. Developing directly on `main` is strictly prohibited.

3. **Commit and push existing changes**: Before creating a new branch, ensure all current changes are committed and pushed.
   ```bash
   git add <relevant-files>
   git commit -m "<descriptive message>"
   git push
   ```

4. **Create a new branch**: Create and switch to a new branch from the latest `main`.
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <prefix>/<branch-name>
   ```

5. **Branch naming convention**: Use the following prefixes followed by a short, descriptive kebab-case name:

   | Prefix   | Usage                                |
   |----------|--------------------------------------|
   | `feat/`  | New feature                          |
   | `fix/`   | Bug fix                              |
   | `debug/` | Debugging or investigation           |
   | `chore/` | Maintenance, config, or dependencies |

   **Examples**:
   - `feat/implement-authentication-logic`
   - `fix/resolve-login-redirect-error`
   - `debug/investigate-api-timeout`
   - `chore/update-eslint-config`

6. **Rules**:
   - Branch names must be lowercase and use hyphens as separators
   - Branch names should clearly describe the scope of work
   - One branch per feature or task — do not mix unrelated changes
   - Always branch off from the latest `main`

7. **When NOT to create a new branch**:
   - When continuing work on an existing feature branch
   - When making a quick amendment to the current branch's work
