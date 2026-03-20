# Session 22: Tree Branch Merge Flow

## Date: 2026-03-19

## Goal
Implement merge flow in the tree view: click "merge to" on target branch, then "merge" on source branch to merge conversations with a summary node.

## Changes

### `frontend/app/tree/[id]/page.tsx`

**New Types:**
- `MergeState`: tracks `status` ('idle' | 'selecting-source' | 'merging' | 'done'), `targetBranchIndex`, `sourceBranchIndex`

**Updated Components:**
- `BranchLabel`: new `mergeRole` prop ('merge-target' | 'merge-source' | null)
  - When a branch has a merge role, it gets amber highlight
  - Status text shown next to the label: "merge to 選択中" or "merge 選択中"
  - Added `MERGE_LABEL_WIDTH` (120px) for the status label foreignObject

**New State:**
- `mergeState` with initial idle state

**Updated Handlers:**
- `handleBranchMenuAction`:
  - "merge to": sets the clicked branch as target, status → 'selecting-source'
  - "merge": if a target is already selected, fires the merge API call
    - status → 'merging' during API call
    - On success: status → 'done', refetch data, auto-reset to 'idle' after 2s
    - On failure: reset to 'idle'
- Added `refetchData` helper for reloading branches + nodes after merge

**UI Additions:**
- Status message bar above tree area:
  - "mergeを選択してください" when selecting source
  - "merge中・・・" during merge
  - "merge完了！" on success
- SVG width expands to accommodate merge status labels

## API Flow
1. User clicks branch label → popover
2. "merge to" → branch highlighted amber, "merge to 選択中"
3. User clicks another branch → popover → "merge"
4. POST `/v1/conversations/{id}/merge` with `{ source_branch_id, target_branch_id, summary_strategy: 'detailed' }`
5. On success: tree refetches, new summary node appears on target branch
