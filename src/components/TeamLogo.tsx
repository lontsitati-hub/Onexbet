import { Image as ExpoImage } from 'expo-image';
import React, { useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { resolveOnlineTeamLogo } from '@/utils/logoResolver';

interface TeamLogoProps {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

/** Écusson direct uniquement : cache disque/mémoire, aucun drapeau de substitution. */
export function TeamLogo({ uri, size = 42, style, accessibilityLabel }: TeamLogoProps) {
  const logoUrl = resolveOnlineTeamLogo(uri);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!logoUrl || failedUrl === logoUrl) return null;

  return (
    <ExpoImage
      source={{ uri: logoUrl }}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={70}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailedUrl(logoUrl)}
    />
  );
}
