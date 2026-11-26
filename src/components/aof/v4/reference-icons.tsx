import React from 'react';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

export function ReferenceGearIcon({ size = 24, withPlus = false }: { size?: number; withPlus?: boolean }) {
  const points = Array.from({ length: 32 }, (_, i) => {
    const angle = (i * Math.PI) / 16 - Math.PI / 2;
    const radius = i % 4 < 2 ? 9.7 : 8.1;
    return `${12 + Math.cos(angle) * radius},${12 + Math.sin(angle) * radius}`;
  }).join(' ');
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Polygon points={points} fill="none" stroke="#FFFFFF" strokeWidth={1.3} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3.4} fill="none" stroke="#FFFFFF" strokeWidth={1.3} />
      {withPlus && <>
        <Circle cx={22} cy={22} r={4} fill="#173F33" stroke="#FFFFFF" strokeWidth={1.2} />
        <Path d="M22 19.8v4.4M19.8 22h4.4" stroke="#FFFFFF" strokeWidth={1.2} />
      </>}
    </Svg>
  );
}

export function ReferenceBoltIcon({ size = 14 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 16 20">
    <Path d="M8 1H15L10 8H14L3 19L6 10H1Z" fill="#FFFFFF" />
  </Svg>;
}
