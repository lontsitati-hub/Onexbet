import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  GAME_IDS,
  GAME_LABELS,
  GameId,
  listGameToggles,
  setGameToggle,
} from '@/services/gameToggles';

const GAME_ICONS: Record<GameId, string> = {
  aviator: 'airplane',
  'apple-of-fortune': 'apple',
  'crash-point': 'chart-line',
  'wild-west-gold': 'trophy-award',
};

const GAME_DESCRIPTIONS: Record<GameId, string> = {
  aviator: 'Le jeu officiel : 2 panneaux, mises anticipées.',
  'apple-of-fortune': 'Montez les 10 rangées : pomme rouge ou trognon pourri.',
  'crash-point': 'Retirez votre mise avant que la courbe ne crashe.',
  'wild-west-gold': 'Grille 2x/3x : trouvez l’or du bas vers le haut et évitez la dynamite.',
};

type Props = {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
};

/**
 * Sécurité par jeu — panneau d'administration.
 *
 * L'activation individuelle des jeux est DÉSACTIVÉE : tous les jeux sont
 * accessibles à tous les joueurs connectés sans validation administrateur.
 * Ce panneau reste uniquement informatif (interrupteurs verrouillés sur ON).
 */
export default function GamesSecurityTab({ onSuccess, onError }: Props) {
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const toggles = await listGameToggles();
      const full: Record<string, boolean> = {};
      GAME_IDS.forEach((id) => {
        const v = toggles[id];
        // Absent = activé par défaut (politique du service).
        full[id] = typeof v === 'boolean' ? v : true;
      });
      setEnabledMap(full);
    } catch {
      // Fallback local : tout activé par défaut.
      const full: Record<string, boolean> = {};
      GAME_IDS.forEach((id) => (full[id] = true));
      setEnabledMap(full);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // L'activation/désactivation par jeu est désactivée : le panneau est
  // désormais uniquement informatif — aucun effet sur les interrupteurs.
  const handleToggle = useCallback(
    (_gameId: GameId, _next: boolean) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSuccess('L\'activation des jeux est désactivée : tous les jeux sont accessibles à tous les joueurs.');
    },
    [onSuccess]
  );

  if (loading || !enabledMap) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A9EFF" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.infoCard}>
        <MaterialCommunityIcons name="gamepad-variant" size={26} color="#4A9EFF" />
        <Text style={styles.infoTitle}>Sécurité par jeu — Désactivée</Text>
        <Text style={styles.infoText}>
          L'activation des jeux n'est plus contrôlée : tous les jeux sont
          accessibles à tous les joueurs connectés sans validation
          administrateur.
        </Text>
      </View>

      {GAME_IDS.map((gameId) => {
        const enabled = enabledMap[gameId] ?? true;
        return (
          <View key={gameId} style={styles.gameRow}>
            <View style={styles.gameIconWrap}>
              <MaterialCommunityIcons
                name={GAME_ICONS[gameId] as never}
                size={24}
                color={enabled ? '#2E7D32' : '#B0B7C3'}
              />
            </View>
            <View style={styles.gameInfo}>
              <Text style={styles.gameTitle}>{GAME_LABELS[gameId]}</Text>
              <Text style={styles.gameDesc}>{GAME_DESCRIPTIONS[gameId]}</Text>
            </View>
            <View style={styles.switchWrap}>
              <Switch
                value={enabled}
                onValueChange={(v) => void handleToggle(gameId, v)}
                trackColor={{ true: '#2E7D32', false: '#C9D3E0' }}
                thumbColor={enabled ? '#FFFFFF' : '#FFFFFF'}
                ios_backgroundColor="#C9D3E0"
              />
              <Text style={[styles.switchLabel, enabled ? styles.switchLabelOn : styles.switchLabelOff]}>
                {enabled ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        );
      })}

      <Text style={styles.footerNote}>
        Tous les jeux sont disponibles pour tous les joueurs connectés.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: { padding: 16, paddingBottom: 32 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5FA',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B2A44',
    marginBottom: 4,
    lineHeight: 20,
  },
  infoText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#4A5870',
    lineHeight: 18,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4EBF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  gameIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gameInfo: { flex: 1, paddingRight: 10 },
  gameTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1B2A44',
    lineHeight: 19,
  },
  gameDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#6B7890',
    lineHeight: 16,
    marginTop: 2,
  },
  switchWrap: {
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  switchLabelOn: { color: '#2E7D32' },
  switchLabelOff: { color: '#9AA4B2' },
  footerNote: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7890',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
});
