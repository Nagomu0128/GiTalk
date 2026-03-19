# Session 20: Tree Branch Label Context Menu

## Date: 2026-03-19

## Goal
Add a context menu (popover) when clicking a branch label in the tree view, with options: merge, merge to, reset, diff, clone.

## Changes

### `frontend/app/tree/[id]/page.tsx`
- Added `BRANCH_MENU_ITEMS` constant: `['merge', 'merge to', 'reset', 'diff', 'clone']`
- Added `BranchMenuState` type (visible, x, y, branchIndex)
- Updated `BranchLabel` component:
  - Now clickable with cursor-pointer
  - Accepts `isSelected` and `onClick` props
  - Selected state: amber border + amber background tint (matching screenshot highlight)
  - Hover state on unselected labels
- Added `BranchPopover` component: popover with 5 menu items styled consistently with NodePopover
- Added `branchMenu` state in page component
- Added handlers:
  - `handleBranchLabelClick`: toggles branch menu popover
  - `handleBranchMenuAction`: logs action + branch info (placeholder for future implementation)
  - `handleCloseBranchMenu`: closes popover
- Rendered `BranchPopover` alongside `NodePopover` in the tree area
