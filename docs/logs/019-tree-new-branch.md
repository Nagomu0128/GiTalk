# Session 19: Tree New Branch - Create & Navigate

## Date: 2026-03-19

## Goal
When clicking "new branch" from the node context menu, create a new branch from that node and navigate to the chat view.

## Changes

### `frontend/app/tree/[id]/page.tsx`
- Added `NewBranchDialog` component: centered confirmation dialog matching the screenshot design
  - Shows "あたらしいチャットに移動しますか？" with Yes/cancel buttons
  - Light theme (neutral-200 bg) to contrast with the dark tree background
  - Loading state while API call is in progress
- Added `newBranchDialog` state (visible, nodeId, position) and `newBranchLoading` state
- Wired "new branch" context menu action to open the dialog
- `handleNewBranchConfirm`:
  1. POST `/v1/conversations/:id/branches` with auto-generated name and base_node_id
  2. POST `/v1/conversations/:id/switch` to switch to the new branch
  3. Navigate to `/conversation/:id` for chat view
- `handleNewBranchCancel`: closes the dialog

## API Flow
1. `POST /v1/conversations/{id}/branches` → `{ name: "branch-{timestamp}", base_node_id: nodeId }`
2. `POST /v1/conversations/{id}/switch` → `{ branch_id: newBranch.id }`
3. `router.push(/conversation/{id})`
