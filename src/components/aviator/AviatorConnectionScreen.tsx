import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const BRAND = require('@/assets/game/aviator-connection-brand.png');

/** Écran de transition local; le routage parent gère la limite de trois secondes. */
export function AviatorConnectionScreen() {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const sequence = Animated.timing(progress, {
      toValue: 3,
      duration: 2100,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    sequence.start();
    return () => sequence.stop();
  }, [progress]);

  return (
    <View style={styles.screen} accessibilityLabel="Connexion Aviator">
      <View style={styles.brandBlock}>
        <Image source={BRAND} style={{ width: Math.min(224, width * 0.35), aspectRatio: 310 / 146 }} resizeMode="contain" accessibilityLabel="Powered by Spribe" />
        <Text style={styles.connection}>Connexion</Text>
        <View style={styles.dots} accessibilityLabel="Connexion en cours">
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[styles.dot, {
                opacity: progress.interpolate({ inputRange: [index, index + 0.5, index + 1], outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }),
                transform: [{ scale: progress.interpolate({ inputRange: [index, index + 0.5, index + 1], outputRange: [0.8, 1.1, 0.8], extrapolate: 'clamp' }) }],
              }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  brandBlock: { position: 'absolute', top: '43%', left: 0, right: 0, alignItems: 'center' },
  connection: { color: '#909090', fontSize: 12, lineHeight: 16, marginTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#DA101A' },
});
