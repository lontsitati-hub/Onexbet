import React from 'react';
import Svg, { Polygon, Text as SvgText } from "react-native-svg";

const SIZE = 30;
const R_OUTER = 14.5;
const R_INNER = 11.5;
const POINTS = 12;

function badgePoints(cx: number, cy: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / (POINTS * 2);
  for (let i = 0; i < POINTS * 2; i++) {
    const r = i % 2 === 0 ? R_OUTER : R_INNER;
    const a = -Math.PI / 2 + i * step; // start at top
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

export function SerratedBadge({ count }: { count?: number }) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const points = badgePoints(cx, cy);
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Outer golden serrated star */}
      <Polygon points={points} fill="#E9C763" stroke="#B8860B" strokeWidth={1.2} />
      {/* Inner lighter disc */}
      <Polygon
        points={badgePoints(cx, cy)}
        fill="none"
        stroke="#FFF3D6"
        strokeWidth={1}
      />
      <SvgText
        x={cx}
        y={cy - 1.5}
        fontSize={5.2}
        fontWeight="900"
        fill="#7A5A10"
        textAnchor="middle"
        fontFamily="system"
      >
        BONUS
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 6.5}
        fontSize={7.5}
        fontWeight="900"
        fill="#7A5A10"
        textAnchor="middle"
        fontFamily="system"
      >
        {Math.max(1, count ?? 3)}
      </SvgText>
    </Svg>
  );
}
