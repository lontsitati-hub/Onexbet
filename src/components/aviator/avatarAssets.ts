import type { ImageSourcePropType } from 'react-native';

export const AVIATOR_PROFILE_AVATARS: ImageSourcePropType[] = [
  require('@/assets/game/avatars/citrus.png'),
  require('@/assets/game/avatars/gold-car.png'),
  require('@/assets/game/avatars/red-plane.png'),
  require('@/assets/game/avatars/app/gold-trophy.png'),
  require('@/assets/game/avatars/app/purple-gem.png'),
  require('@/assets/game/avatars/app/red-helmet.png'),
  require('@/assets/game/avatars/app/blue-controller.png'),
  require('@/assets/game/avatars/app/golden-coins.png'),
];

/** Tire des avatars aléatoires; l’option distinct évite les doublons d’une pile. */
export const getRandomAviatorAvatars = (count: number, distinct = false): ImageSourcePropType[] => {
  const safeCount = Math.max(0, Math.floor(count));
  if (distinct) {
    const shuffled = [...AVIATOR_PROFILE_AVATARS];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled.slice(0, safeCount);
  }
  return Array.from({ length: safeCount }, () => (
    AVIATOR_PROFILE_AVATARS[Math.floor(Math.random() * AVIATOR_PROFILE_AVATARS.length)]
  ));
};
