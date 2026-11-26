import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export default function EmptyBetHistoryMascot() {
  return (
    <Image
      source={require('../../assets/videos/bet-history-empty.gif')}
      style={styles.animation}
      contentFit="contain"
      accessibilityLabel="Animation de la mascotte lorsqu’il n’y a aucun pari"
    />
  );
}

const styles = StyleSheet.create({
  animation: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 560 / 480,
    marginBottom: 12,
    pointerEvents: 'none',
  },
});
