'use client';

import { useTheme } from 'next-themes';

const IMAGE_MAP: Record<string, { light: string; dark: string }> = {
  logo: { light: '/light_mode_logo.png', dark: '/dark_mode_logo.png' },
  logo_with_circle: { light: '/light_mode_logo_with_circle.png', dark: '/dark_mode_logo_with_circle.png' },
  login_background: { light: '/light_mode_login_background_image.png', dark: '/dark_mode_login_background_image.png' },
  box: { light: '/light_mode_box_image.png', dark: '/dark_mode_box_image.png' },
  branch: { light: '/light_mode_branch_image.png', dark: '/dark_mode_branch_image.png' },
  merge: { light: '/light_mode_merge_image.png', dark: '/dark_mode_merge_image.png' },
};

export const useThemeImage = (key: keyof typeof IMAGE_MAP): string => {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
  return IMAGE_MAP[key][mode];
};
