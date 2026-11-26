import React from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { formatF, useGame, type HistoryEntry } from '@/components/aof/v4/game-store';
import { COLS, ROWS } from './game-logic';

const MULT_STR: Record<number, string> = {
  1: "1.23",
  2: "1.54",
  3: "1.93",
  4: "2.41",
  5: "4.02",
  6: "6.71",
  7: "11.18",
  8: "27.97",
  9: "69.93",
  10: "349.68",
};

const ALPHAS = ["a", "b", "c", "d", "e"];

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Settings sheet — all the former History screen functionality now lives here:
 * predictor (choose winning cells before playing), balance reset, recent
 * matches, plus sound/haptics toggles.
 */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const game = useGame();

  const totalPredictions = Object.values(game.predictions).reduce(
    (acc, cols) => acc + cols.length,
    0
  );

  const hasValidated = Object.keys(game.validatedPredictions).length > 0;
  const totalValidated = Object.values(game.validatedPredictions).reduce(
    (acc, cols) => acc + cols.length,
    0
  );
  /** La grille du prédicteur édite le brouillon. Si une prédiction est
   *  déjà validée, le brouillon est pré-rempli avec elle pour faciliter
   *  les ajustements. */
  const effectivePredictions = hasValidated ? game.validatedPredictions : game.predictions;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sheetTitle}>Paramètres</Text>

          {/* ============ TOGGLES ============ */}
          <View style={styles.toggleCard}>
            <Text style={styles.toggleLabel}>Sons</Text>
            <Pressable
              onPress={() => {
                void game.toggleSound();
                if (Platform.OS !== "web") {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={[styles.toggle, game.soundEnabled ? styles.toggleOn : styles.toggleOff]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  game.soundEnabled ? styles.toggleKnobOn : styles.toggleKnobOff,
                ]}
              />
            </Pressable>
          </View>
          <View style={styles.toggleCard}>
            <Text style={styles.toggleLabel}>Vibrations</Text>
            <Pressable
              onPress={() => {
                void game.toggleHaptics();
                if (Platform.OS !== "web" && game.hapticsEnabled) {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={[styles.toggle, game.hapticsEnabled ? styles.toggleOn : styles.toggleOff]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  game.hapticsEnabled ? styles.toggleKnobOn : styles.toggleKnobOff,
                ]}
              />
            </Pressable>
          </View>

          {/* ============ PREDICTOR ============ */}
          <View style={styles.predictorCard}>
            <View style={styles.predictorHeader}>
              <Text style={styles.predictorTitle}>🔮 Mode prédicteur</Text>
              {totalPredictions > 0 && (
                <Pressable
                  onPress={() => void game.clearPredictions()}
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text allowFontScaling={false} style={styles.clearBtnText}>Effacer</Text>
                </Pressable>
              )}
              {hasValidated && (
                <Pressable
                  onPress={() => void game.clearValidatedPredictions()}
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text allowFontScaling={false} style={styles.clearBtnText}>Retirer la validation</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.predictorHint}>
              Touche les cases qui doivent gagner avant de jouer. La partie utilisera tes
              prédictions : les trognons seront placés ailleurs.
              {hasValidated ? ' Retire la validation avant de modifier les cases.' : ''}
            </Text>
            <View style={styles.predictGrid}>
              {Array.from({ length: ROWS }).map((_, i) => {
                const row = ROWS - 1 - i; // display top-down; row 0 = bottom
                return (
                  <View key={row} style={styles.predictRow}>
                    <Text style={styles.predictMult}>×{MULT_STR[row + 1]}</Text>
                    {Array.from({ length: COLS }).map((_, c) => {
                      const isOn = (effectivePredictions[row] ?? []).includes(c);
                      return (
                        <Pressable
                          key={c}
                          disabled={hasValidated}
                          onPress={() => {
                            if (Platform.OS !== "web") {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                            game.setPrediction(row, c);
                          }}
                          style={({ pressed }) => [
                            styles.predictCell,
                            isOn ? styles.predictCellOn : styles.predictCellOff,
                            pressed && { transform: [{ scale: 0.92 }] },
                          ]}
                        >
                          <Text allowFontScaling={false} style={[styles.predictCellLabel, isOn && styles.predictCellLabelOn]}>
                            {ALPHAS[c]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
            <Text style={styles.predictStatus}>
              {hasValidated
                ? `Prédiction validée : ${totalValidated} case${totalValidated > 1 ? "s" : ""} — appliquée à chaque partie jusqu'à retrait ou effacement.`
                : totalPredictions === 0
                ? "Aucune prédiction — la partie sera aléatoire."
                : `${totalPredictions} case${totalPredictions > 1 ? "s" : ""} prédite${totalPredictions > 1 ? "s" : ""} — en brouillon : valide ci-dessous pour l'appliquer.`}
            </Text>
            {!hasValidated && totalPredictions > 0 && (
              <Pressable
                onPress={() => {
                  void game.commitPredictions();
                  if (Platform.OS !== "web") {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
                style={({ pressed }) => [styles.validateBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 }]}
              >
                <Text allowFontScaling={false} style={styles.validateBtnText}>✔ Valider la prédiction</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                Alert?.alert(
                  "Comment ça marche",
                  "Choisis dans cette grille les cases qui doivent gagner. Quand tu lanceras une partie, les trognons seront placés sur les cases non prédites, donc tes prédictions seront gagnantes."
                );
              }}
              style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.7 }]}
            >
              <Text allowFontScaling={false} style={styles.infoBtnText}>ℹ Comment ça marche</Text>
            </Pressable>
          </View>

          {/* ============ RESET ============ */}
          <View style={styles.resetCard}>
            <Text style={styles.resetTitle}>Solde : {formatF(game.balance)}</Text>
            <Text style={styles.resetHint}>
              Réinitialiser remet le solde à {formatF(100000)} et efface l&#39;historique des
              parties.
            </Text>
            <Pressable
              onPress={() => {
                Alert?.alert(
                  "Réinitialiser le solde ?",
                  `Ton solde reviendra à ${formatF(100000)} ₣ et l'historique sera effacé.`,
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Réinitialiser",
                      style: "destructive",
                      onPress: () => {
                        void game.resetBalance();
                        void game.clearPredictions();
                        if (Platform.OS !== "web") {
                          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                      },
                    },
                  ]
                );
              }}
              style={({ pressed }) => [styles.resetBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 }]}
            >
              <Text allowFontScaling={false} style={styles.resetBtnText}>Réinitialiser le solde</Text>
            </Pressable>
          </View>

          {/* ============ HISTORY LIST ============ */}
          <Text style={styles.sectionTitle}>Parties récentes</Text>
          {game.history.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Aucune partie jouée pour le moment. Lance ta première partie !
              </Text>
            </View>
          ) : (
            <FlatList
              data={game.history}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }: { item: HistoryEntry }) => (
                <View style={styles.card}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardResult}>
                      {item.result === "win" ? "Victoire" : "Défaite"}
                    </Text>
                    <Text style={styles.cardDate}>
                      {new Date(item.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardPayout}>
                      {item.result === "win" ? `+${formatF(item.payout)}` : `−${formatF(item.bet)}`}
                    </Text>
                    <Text style={styles.cardMeta}>
                      Mise {formatF(item.bet)} · {item.levelReached} rangée
                      {item.levelReached > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.8 }]}
        >
          <Text allowFontScaling={false} style={styles.closeBtnText}>Fermer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "82%",
    backgroundColor: "#0A2018",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 0,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "#2C5A47",
    borderBottomColor: "#2C5A47",
  },
  sheetContent: {
    padding: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F7F2E3",
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 28,
  },
  closeBtn: {
    alignSelf: "center",
    backgroundColor: "#23473A",
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#3B6B55",
  },
  closeBtnText: {
    color: "#F7F2E3",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#11362B",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2C5A47",
    marginBottom: 10,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F7F2E3",
    lineHeight: 20,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    padding: 3,
  },
  toggleOn: {
    backgroundColor: "#2FA33C",
    borderWidth: 1,
    borderColor: "#7FE88E",
  },
  toggleOff: {
    backgroundColor: "rgba(234, 242, 236, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 242, 236, 0.3)",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleKnobOn: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-end",
  },
  toggleKnobOff: {
    backgroundColor: "#9FBFAF",
    alignSelf: "flex-start",
  },
  predictorCard: {
    backgroundColor: "#11362B",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2C5A47",
    marginBottom: 12,
  },
  predictorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  predictorTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFD666",
    lineHeight: 23,
  },
  clearBtn: {
    backgroundColor: "rgba(255, 90, 60, 0.25)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 90, 60, 0.6)",
  },
  clearBtnText: {
    color: "#FF9A7F",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  predictorHint: {
    color: "#9FBFAF",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 10,
  },
  resetCard: {
    backgroundColor: "#11362B",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2C5A47",
    marginBottom: 12,
  },
  resetTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFD666",
    lineHeight: 23,
  },
  resetHint: {
    color: "#9FBFAF",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  resetBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 90, 60, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 90, 60, 0.6)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  resetBtnText: {
    color: "#FF9A7F",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  predictGrid: {
    gap: 5,
    marginBottom: 10,
  },
  predictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  predictMult: {
    width: 42,
    fontSize: 9,
    fontWeight: "700",
    color: "#8BA899",
    textAlign: "center",
    lineHeight: 12,
  },
  predictCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  predictCellOff: {
    backgroundColor: "rgba(234, 242, 236, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 242, 236, 0.25)",
  },
  predictCellOn: {
    backgroundColor: "#2FA33C",
    borderWidth: 1,
    borderColor: "#7FE88E",
  },
  predictCellLabel: {
    color: "#8BA899",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  predictCellLabelOn: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  predictStatus: {
    color: "#9FBFAF",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  validateBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#2FA33C",
    borderWidth: 1,
    borderColor: "#7FE88E",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 6,
    marginBottom: 6,
  },
  validateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  infoBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(234, 242, 236, 0.12)",
  },
  infoBtnText: {
    color: "#CDE5D8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#CDE5D8",
    marginBottom: 8,
    lineHeight: 21,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  emptyText: {
    color: "#9FBFAF",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#11362B",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2C5A47",
    marginBottom: 10,
  },
  cardLeft: {
    gap: 2,
  },
  cardResult: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F7F2E3",
    lineHeight: 21,
  },
  cardDate: {
    fontSize: 12,
    color: "#8BA899",
    lineHeight: 16,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  cardPayout: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  cardMeta: {
    fontSize: 12,
    color: "#8BA899",
    lineHeight: 16,
  },
});
