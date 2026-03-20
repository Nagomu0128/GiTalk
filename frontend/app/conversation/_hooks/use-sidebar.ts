'use client';

import { useState, useEffect, useCallback } from 'react';

export const useSidebar = (defaultCollapsed = false) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { collapsed, toggle } as const;
};
