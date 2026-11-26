import React, { useId } from 'react';
import Svg, { Circle, Defs, G, Mask, Path, Polygon, Rect } from 'react-native-svg';

export const SPORT_LOADER_COUNT = 8;

/** Eight vector redraws of the original round, white sports-ball silhouettes.
 * The tiny sources do not identify every sport reliably: preserve their seams,
 * panel swirls and central mark rather than substitute unrelated pictograms. */
export function SportLoaderIcon({ index, size = 24 }: { index: number; size?: number }) {
  const i = ((index % SPORT_LOADER_COUNT) + SPORT_LOADER_COUNT) % SPORT_LOADER_COUNT;
  const maskId = `loader-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={`Ballon de sport ${i + 1}`}>
      <Defs>
        <Mask id={maskId} x={0} y={0} width={24} height={24} maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={24} height={24} fill="#FFFFFF" />
          <G stroke="#000000" strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round" fill="none">
            {i === 0 && <>
              <Polygon points="12,8.35 15.48,10.88 14.15,14.98 9.85,14.98 8.52,10.88" />
              <Path d="M12 2.75v5.6M21 9.1l-5.52 1.78M17.8 19.1l-3.65-4.12M6.2 19.1l3.65-4.12M3 9.1l5.52 1.78" />
              <Path d="M7.2 3.8L6 6.15 3.55 7.55M16.8 3.8L18 6.15l2.45 1.4M3.1 15.5l2.8.65L7.6 19.7M20.9 15.5l-2.8.65-1.7 3.55M9.55 21.15L12 19.8l2.45 1.35" />
            </>}
            {i === 1 && <>
              <Path d="M2.75 12h18.5M12 2.75v18.5M5.2 5.65c5.1 3.5 5.1 9.2 0 12.7M18.8 5.65c-5.1 3.5-5.1 9.2 0 12.7" />
            </>}
            {i === 2 && <>
              <Path d="M8.25 3.55c-1.4 4.7 1.1 7.95 6 8.9 3.15.6 5.1 2.4 5.45 4.35M4.15 6.95c.55 3.05 2.55 4.8 5.7 5.4 4.9.95 7.4 4.2 6 8.1" />
            </>}
            {i === 3 && <>
              <Path d="M9 3.2c-2.45 5.65-2.45 11.95 0 17.6M15 3.2c2.45 5.65 2.45 11.95 0 17.6M3.3 8.1c5.4 2.3 11.9 2.3 17.4 0M3.3 15.9c5.4-2.3 11.9-2.3 17.4 0" />
            </>}
            {i === 4 && <>
              <Path d="M12 12c-4.3-.3-6.5-3.3-6.8-7.3M12 12c2.4-3.55 6.1-4.1 9.2-2.55M12 12c1.9 3.85.6 7.1-2.65 9.25M7.5 3.95c.5 4.65 3.45 7.15 8.1 6.85M20.3 13.55c-4.3 1.9-7.85.85-10.3-3.1M7.7 20.2c3.8-2.75 4.5-6.5 2.3-10.7" />
            </>}
            {i === 5 && <Circle cx={12} cy={12} r={3.1} fill="#000000" stroke="none" />}
            {i === 6 && <>
              <Path d="M5.8 4.95c5.35 3.45 5.35 10.65 0 14.1M18.2 4.95c-5.35 3.45-5.35 10.65 0 14.1M7.2 6.5l-1.65.4M8.75 9.15l-1.75.8M9.15 12H7.3M8.75 14.85l-1.75-.8M7.2 17.5l-1.65-.4M16.8 6.5l1.65.4M15.25 9.15l1.75.8M14.85 12h1.85M15.25 14.85l1.75-.8M16.8 17.5l1.65-.4" />
            </>}
            {i === 7 && <>
              <Path d="M5.5 5.45c-.5 5.25 2.1 8.6 7.35 9.2M18.5 5.45c-5.15 1.75-7.4 5.4-6.3 10.65M12.15 21.1c4.4-3.55 5.4-7.8 2.1-11.75M8.15 3.65c-.4 4.7 1.35 7.25 5.5 8.8M20.6 8.3c-4.3 1.65-6.7 4.45-6.7 8.4M6.75 19.1c3.3-2.55 4.5-5.3 3.7-9.35" />
            </>}
          </G>
        </Mask>
      </Defs>
      <Circle cx={12} cy={12} r={9.25} fill="#FFFFFF" mask={`url(#${maskId})`} />
    </Svg>
  );
}
