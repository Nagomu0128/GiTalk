'use client';

import { useState } from 'react';

export const useDialogState = () => {
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [showPushDialog, setShowPushDialog] = useState(false);

  return {
    showMergeDialog,
    showDiffView,
    showPushDialog,
    openMergeDialog: () => setShowMergeDialog(true),
    closeMergeDialog: () => setShowMergeDialog(false),
    openDiffView: () => setShowDiffView(true),
    closeDiffView: () => setShowDiffView(false),
    openPushDialog: () => setShowPushDialog(true),
    closePushDialog: () => setShowPushDialog(false),
  };
};
