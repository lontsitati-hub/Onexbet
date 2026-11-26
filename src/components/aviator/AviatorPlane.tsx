import React from "react";
import Svg, { Path, Ellipse, Circle } from "react-native-svg";

/**
 * Avion Aviator stylisé en SVG vectoriel, fidèle au logo officiel :
 * corps rouge (#E4331E), hélice tripale devant le nez, X sur le cockpit,
 * train d'atterrissage stylisé, vue de profil légèrement inclinée.
 * Le composant est centré sur l'origine, l'orientation se gère par transform.
 * Intégré depuis la version v41 d'Aviator.
 */
export function AviatorPlane({ size = 84, color = "#E4331E" }: { size?: number; color?: string }) {
  const w = size * 1.6;
  const h = size * 0.8;
  return (
    <Svg width={w} height={h} viewBox="0 0 160 80" fill="none">
      {/* Hélice tripale (devant le nez, ellipse inclinée) */}
      <Ellipse cx="150" cy="40" rx="9" ry="30" fill={color} opacity="0.92" transform="rotate(24 150 40)" />
      <Circle cx="150" cy="40" r="4.5" fill="#8C1408" />
      {/* Fuselage principal */}
      <Path
        d="M18 58
           C 30 50, 52 40, 84 34
           C 104 30, 124 28, 142 30
           C 147 31, 150 34, 150 37
           C 150 41, 146 43, 140 43
           C 118 43, 92 46, 70 50
           C 46 55, 30 60, 22 62
           C 18 63, 16 61, 18 58 Z"
        fill={color}
      />
      {/* Aile haute stylisée */}
      <Path
        d="M52 44 L 96 33 L 102 38 L 58 50 Z"
        fill={color}
        opacity="0.95"
      />
      {/* Empennage arrière */}
      <Path d="M18 56 L 6 44 L 10 42 L 22 52 Z" fill={color} />
      <Path d="M22 58 L 8 64 L 14 66 L 26 60 Z" fill={color} />
      {/* Cockpit (verrière) */}
      <Path
        d="M92 34 C 100 28, 116 26, 126 29 C 132 31, 134 34, 130 36 C 118 40, 100 41, 92 38 Z"
        fill="#FF9A8A"
        opacity="0.55"
      />
      {/* X sur le cockpit */}
      <Path d="M108 31 L 118 37 M 118 31 L 108 37" stroke="#7A1005" strokeWidth="2.4" strokeLinecap="round" />
      {/* Train d'atterrissage stylisé */}
      <Path d="M62 52 L 56 66 L 72 66 Z" fill={color} opacity="0.9" />
    </Svg>
  );
}
