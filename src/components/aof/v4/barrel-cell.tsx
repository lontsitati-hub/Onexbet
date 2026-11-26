import React from 'react';
import { Image, Pressable, StyleSheet, View } from "react-native";

import { GAME_ASSETS } from '@/components/aof/v4/use-game-assets';
import type { CellState } from './game-logic';

type BarrelCellProps = {
  state: CellState | null; // null = hidden (wood plank)
  playable: boolean;
  onPress: () => void;
  size: number;
  disabled?: boolean;
  /** 0..1 opacity multiplier for row fade-out (rows already cleared fade away). */
  rowFade?: number;
  /** staggered reveal animation: appears after a delay */
  revealAfter?: number;
  /** alias used for the end-of-round in-place sweep reveal */
  revealStagger?: number;
  /** when false, the wood plank shows a flat uncarved surface (no chevrons) —
   *  rows not yet reached keep their chevrons hidden until the player advances */
  chevronsVisible?: boolean;
  /** crossed rows vanish instantly once the player moves to the next row */
  vanish?: boolean;
};

export function BarrelCell({ state, playable, onPress, size, disabled, rowFade = 1, revealAfter, revealStagger, chevronsVisible: propsChevronsVisible, vanish }: BarrelCellProps) {
  const chevronsVisible = propsChevronsVisible ?? true;
  // Instant reveal: the tile appears immediately with no pop/bounce/delay —
  // the user asked for the change to be instantaneous (tap and end-of-round).
  // Crossed rows fade progressively as the player moves to the next row.
  const isRevealed = state !== null;

  const target = vanish ? 0 : rowFade;
  const pressStyle = { opacity: target };

  let tileUri = GAME_ASSETS.plankWood;
  if (state === "apple") tileUri = GAME_ASSETS.plankWin;
  if (state === "core") tileUri = GAME_ASSETS.plankLose;

  // Unreached rows: plain blank wood disc without chevrons (revealed progressively).
  const woodUri = chevronsVisible ? GAME_ASSETS.plankWood : GAME_ASSETS.plankBlank;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !playable || isRevealed}
      style={({ pressed }) => [
        pressStyle,
        styles.cell,
        { width: size, height: size },
        isRevealed && styles.cellRevealed,
        pressed && styles.cellPressed,
      ]}
    >
      <View style={[styles.imageWrap, { width: size, height: size }]}>
        {/* Always keep the wood disc behind so revealed tiles never show a white void. */}
        <Image
          source={woodUri}
          style={[styles.image, styles.imageWood, styles.layerBase, chevronsVisible && { opacity: 1 }]}
          resizeMode="cover"
        />
        {isRevealed && (
          <Image
            source={tileUri}
            style={[styles.image, styles.imageReveal, styles.layerTile]}
            resizeMode="cover"
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    justifyContent: "center",
  },
  cellPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  cellRevealed: {
    backgroundColor: "transparent",
  },
  imageWrap: {
    borderRadius: 4,
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  imageWood: {
    zIndex: 0,
    // Let the game background show through the unrevealed wood. Keep this
    // opacity on the base layer only so apples/cores remain fully saturated.
    opacity: 0.46,
  },
  layerBase: {},
  imageReveal: {
    zIndex: 1,
  },
  layerTile: {},
});
