# Session 18: Tree Read Button - Chat Panel

## Date: 2026-03-19

## Goal
Add chat history panel to `/tree/[id]` page that opens when clicking the "read" button on a node's context menu.

## Changes

### `frontend/app/tree/[id]/page.tsx`
- Added imports: `X` (lucide), `DOMPurify`, `ReactMarkdown`
- Added `collectPathMessages()` helper: traces from a node back to root and returns ordered conversation nodes
- Added `ChatPanel` component: right-side panel (420px) showing user messages and AI responses in chat bubble style
  - User messages: right-aligned, dark background
  - AI responses: left-aligned with "G" avatar, markdown rendered
  - Auto-scrolls to bottom on open
  - Close button (X) in header
- Added `chatPanelNodeId` state and `chatPanelMessages` memo
- Wired "read" context menu action to:
  1. Open chat panel with messages from root to selected node
  2. Highlight the path (red lines) from root to selected node
- `handleCloseChatPanel` clears panel and removes highlights

## Design Reference
- Matches the provided screenshot: tree on left, chat panel on right
- Dark theme consistent with existing UI (neutral-800/900)
- Red highlight on the path connecting nodes to the read target
