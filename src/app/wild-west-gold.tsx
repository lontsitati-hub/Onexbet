import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import WildWestGoldGame from '@/components/wwg/WildWestGoldGame';
import { checkAccess } from '@/services/access';
import { isGameEnabled } from '@/services/gameToggles';
import { navigateTo1xGames } from '@/utils/gameNavigation';

export default function WildWestGoldScreen() {
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const access = checkAccess('/wild-west-gold');
      if (!access.allowed) {
        navigateTo1xGames();
        return () => { active = false; };
      }
      void isGameEnabled('wild-west-gold').then((enabled) => {
        if (!active) return;
        if (!enabled) {
          Alert.alert('Wild West Gold', 'Ce jeu est temporairement indisponible.');
          navigateTo1xGames();
        }
      });
      return () => { active = false; };
    }, []),
  );

  return <WildWestGoldGame />;
}
