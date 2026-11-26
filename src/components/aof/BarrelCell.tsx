import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { CellState } from '@/services/appleLogic';
import { AOF_ASSETS } from './assets';


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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BarrelCell({ state, playable, onPress, size, disabled, rowFade = 1, revealAfter, revealStagger, chevronsVisible: propsChevronsVisible, vanish }: BarrelCellProps) {
  const scale = useSharedValue(1);
  const chevronsVisible = propsChevronsVisible ?? true;
  // Instant reveal: the tile appears immediately with no pop/bounce/delay —
  // the user asked for the change to be instantaneous (tap and end-of-round).
  // Crossed rows vanish instantly as soon as the player moves to the next row.
  const isRevealed = state !== null;

  // Revealed cells stay fully visible even on faded past rows — the win must always be readable.
  // Le fading / vanishing instantané des rangées est calculé dans le style animé
  // (jamais d'écriture de shared value pendant le render).
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: vanish ? 0 : isRevealed ? 1 : rowFade,
  }));

  // Reveal is instant: no animated style needed.
  const popStyle = Object.freeze({});

  const handlePressIn = () => {
    scale.value = withTiming(0.94, { duration: 80 }); // eslint-disable-line react-hooks/immutability
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 }); // eslint-disable-line react-hooks/immutability
  };

  // Les require(...) renvoient un identifiant local (nombre) qui doit être
  // passé directement à source ; l'objet { uri: nombre } est invalide sur
  // mobile et fait planter l'écran.
  let tileSrc = AOF_ASSETS.plankWood;
  if (state === 'apple') tileSrc = AOF_ASSETS.plankWin;
  if (state === 'core') tileSrc = AOF_ASSETS.plankLose;

  // Unreached rows: plain blank wood disc without chevrons (revealed progressively).
  const woodSrc = chevronsVisible ? AOF_ASSETS.plankWood : AOF_ASSETS.plankBlank;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !playable || isRevealed}
      style={[
        pressStyle,
        styles.cell,
        { width: size, height: size },
        isRevealed && styles.cellRevealed,
      ]}
    >
      <View style={[styles.imageWrap, { width: size, height: size }]}>
        {/* Always keep the wood disc behind so revealed tiles never show a white void. */}
        <Image
          source={woodSrc}
          style={[styles.image, styles.imageWood, styles.layerBase]}
          resizeMode="cover"
        />
        {isRevealed && (
          <Image
            source={tileSrc}
            style={[styles.image, styles.imageReveal, styles.layerTile]}
            resizeMode="cover"
          />
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    justifyContent: "center",
  },
  cellRevealed: {
    backgroundColor: "transparent",
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageWood: {
    // Hidden wood planks fill the entire cell (full bleed) so the chevrons are clearly visible.
    borderRadius: 6,
  },
  imageReveal: {
    borderRadius: 9999,
    // Revealed round disc fills the cell fully (cover keeps the apple/core large and vivid).
    width: "100%",
    height: "100%",
  },
  layerBase: {
    position: "absolute",
  },
  layerTile: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  imageRevealContained: {
    // Revealed tile fills the whole padded cell: apple/core big and centered like the original game.
    width: "100%",
    height: "100%",
  },
  imagePlay: {
    opacity: 1,
  },
});
