'use client';

import Image from 'next/image';
import { useThemeImage } from '@/hooks/use-theme-image';

export const ThemedLogo = ({
  variant = 'logo',
  width = 44,
  height = 44,
  className,
}: {
  readonly variant?: 'logo' | 'logo_with_circle';
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
}) => {
  const src = useThemeImage(variant);
  return <Image src={src} alt="GiTalk" width={width} height={height} className={className} />;
};
