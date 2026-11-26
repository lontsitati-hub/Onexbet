import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type PanelMode = "bet" | "auto";
type RoundPhase = "waiting" | "flying" | "crashed";

interface Props {
  balance: number;
  bet: { amount: number; cashedOutAt: number | null } | null;
  /** Mise anticipée placée pendant le vol / après le crash (débitée, s'active à la prochaine manche) */
  pending: number | null;
  phase: RoundPhase;
  liveMultiplier: number | null;
  crashMultiplier: number | null;
  onPlace: (amount: number) => string | null;
  onCancel: () => void;
  onCashOut: () => number | null;
  onPlacePending: (amount: number) => string | null;
  onCancelPending: () => void;
}

/**
 * Panneau de mise fidèle au vrai Aviator :
 * - sélecteur pill Bet | Auto
 * - ligne : (−) montant (+) | gros bouton vert arrondi
 * - grille de montants rapides 65 / 130 / 260 / 520 / 1 000 (XAF)
 * - Placement anticipé : pendant le vol ou après un crash, le clic place une
 *   mise pour la manche suivante (débitée immédiatement, "En attente" affiché
 *   jusqu'au prochain décollage) — comme le vrai Aviator.
 * Fidèle à la vidéo officielle (youtube.com/shorts/iyY5xUIObL4) :
 * - Pendant le vol, le bouton devient ORANGE « CASH OUT » avec le gain potentiel
 *   qui augmente en temps réel (montant × cote en vol) ;
 * - après encaissement : vert « BET » ; après crash : vert « BET » ;
 * - le bouton redevient vert pour relancer la prochaine manche.
 */
export function BetPanel({
  balance,
  bet,
  pending,
  phase,
  liveMultiplier,
  crashMultiplier,
  onPlace,
  onCancel,
  onCashOut,
  onPlacePending,
  onCancelPending,
}: Props) {
  const [mode, setMode] = useState<PanelMode>("bet");
  const [amount, setAmount] = useState(1);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const adjust = (factor: number) => {
    haptic();
    setAmount((a) => Math.max(1, Math.round(Math.min(balance, a * factor) * 100) / 100));
  };

  const setQuick = (q: number) => {
    haptic();
    setAmount(Math.min(q, balance));
  };

  // Comportement du bouton principal, fidèle au vrai Aviator :
  // - crashed/flying sans mise en cours : clic → place une mise anticipée
  //   pour la prochaine manche (débitée tout de suite) ; clic suivant →
  //   annule et rembourse.
  // - flying avec mise active : CASH OUT orange ; cashed out : GAIN vert ;
  //   crashée : BET vert (solde).
  // - waiting avec mise active : CANCEL rouge (rembourse).
  // - waiting avec mise anticipée : CANCEL rouge (rembourse la pending).
  const handleAction = () => {
    if (phase === "waiting" && bet) {
      onCancel();
      haptic();
      return;
    }
    if (phase === "waiting" && pending !== null) {
      onCancelPending();
      haptic();
      return;
    }
    if (phase === "flying" && bet && bet.cashedOutAt === null) {
      const payout = onCashOut();
      if (payout !== null && Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }
    if (phase === "waiting" && !bet && pending === null) {
      const err = onPlace(amount);
      if (!err) haptic();
      return;
    }
    // Vol / crash : placement anticipé pour la prochaine manche
    if ((phase === "flying" || phase === "crashed") && pending === null) {
      const err = onPlacePending(amount);
      if (!err) haptic();
      return;
    }
    if ((phase === "flying" || phase === "crashed") && pending !== null) {
      onCancelPending();
      haptic();
      return;
    }
    if (phase === "crashed" && bet && bet.cashedOutAt !== null) {
      const err = onPlacePending(amount);
      if (!err) haptic();
      return;
    }
    if (phase === "crashed" && bet && bet.cashedOutAt === null) {
      const err = onPlacePending(amount);
      if (!err) haptic();
      return;
    }
  };

  // --- Rendu du gros bouton : couleur UNIQUEMENT VERTE (#28A912) en toute
  // circonstance (en cours comme non en cours) — aucune variation de couleur.
  // Le texte adapte selon l'état pour rester lisible (gain potentiel,
  // encaissement, mise en attente...), mais le fond reste toujours vert.
  const mainBtn = (() => {
    if (phase === "waiting" && bet) {
      return { label: "BET — Annuler", sub: null, bg: "#18bd8a", textColor: "#fff" };
    }
    if (phase === "waiting" && pending !== null) {
      // Mise anticipée engagée : affichage "En attente" sur bouton vert
      return { label: "BET — En attente", sub: `×${pending.toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
    }
    // Pendant le vol : bouton VERT avec le gain potentiel qui augmente
    if (phase === "flying" && bet && bet.cashedOutAt === null) {
      const cashOutGain = liveMultiplier !== null ? bet.amount * liveMultiplier : bet.amount;
      return {
        label: "BET — Cash out",
        sub: `${cashOutGain.toFixed(2)} XAF`,
        bg: "#18bd8a",
        textColor: "#fff",
      };
    }
    if (phase === "flying" && bet && bet.cashedOutAt !== null) {
      return { label: "BET — Gain", sub: `+${(bet.amount * (bet.cashedOutAt ?? 0)).toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
    }
    if (phase === "flying" && !bet) {
      if (pending !== null) {
        return { label: "BET — En attente", sub: `×${pending.toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
      }
      return { label: "BET", sub: `${amount.toFixed(2)} XAF — prochaine manche`, bg: "#18bd8a", textColor: "#fff" };
    }
    if (phase === "crashed" && bet && bet.cashedOutAt !== null) {
      // Mise gagnante encaissée + mise anticipée pour la prochaine manche :
      // la pending reste visible et annulable (rembourse immédiatement).
      if (pending !== null) {
        return { label: "BET — En attente", sub: `×${pending.toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
      }
      return { label: "BET", sub: `${balance.toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
    }
    if (phase === "crashed" && bet && bet.cashedOutAt === null) {
      // « Pas de chance » : mise perdue ; le bouton reste BET vert avec
      // le solde et le clic place une mise anticipée pour la prochaine manche.
      if (pending !== null) {
        return { label: "BET — En attente", sub: `×${pending.toFixed(2)} XAF — cliquez pour annuler`, bg: "#18bd8a", textColor: "#fff" };
      }
      return { label: "BET", sub: `${balance.toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
    }
    // En attente : mise anticipée pour cette manche → annulable ; sinon BET
    if (pending !== null) {
      return { label: "BET — En attente", sub: `×${pending.toFixed(2)} XAF — cliquez pour annuler`, bg: "#18bd8a", textColor: "#fff" };
    }
    return { label: "BET", sub: `${amount.toFixed(2)} XAF`, bg: "#18bd8a", textColor: "#fff" };
  })();

  const hasCashOutResult = phase === "crashed" && bet && bet.cashedOutAt !== null;
  const isDisabled = (() => {
    // Le bouton est cliquable dans tous les états (Aviator réel), donc jamais désactivé
    void crashMultiplier;
    return false;
  })();
  void isDisabled;

  return (
    <View style={styles.panel}>
      {/* Sélecteur Bet / Auto */}
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode("bet")}
          style={[styles.modePill, mode === "bet" && styles.modePillActive]}>
          <Text style={[styles.modeText, mode === "bet" && { color: "#fff" }]}>Bet</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("auto")}
          style={[styles.modePill, mode === "auto" && styles.modePillActive]}>
          <Text style={[styles.modeText, mode === "auto" && { color: "#fff" }]}>Auto</Text>
        </Pressable>
      </View>

      {/* Ligne principale : montant + gros bouton */}
      <View style={styles.actionRow}>
        <View style={styles.amountCol}>
          <View style={styles.amountRow}>
            <Pressable
              onPress={() => adjust(0.5)}
              style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.6 }]}>
              <Text style={styles.circleText}>−</Text>
            </Pressable>
            <Text style={styles.amountText}>{amount.toFixed(2)}</Text>
            <Pressable
              onPress={() => adjust(2)}
              style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.6 }]}>
              <Text style={styles.circleText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.quickGrid}>
            {[65, 130, 260, 520, 1000].map((q) => (
              <Pressable
                key={q}
                onPress={() => setQuick(q)}
                style={({ pressed }) => [
                  styles.quickBtn,
                  pressed && { opacity: 0.6 },
                  amount === Math.min(q, balance) && { backgroundColor: "#3A3D46" },
                ]}>
                <Text style={styles.quickText}>{q.toLocaleString("fr-FR")}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.mainButtonColumn}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mainBtn.label}
            onPress={handleAction}
            style={({ pressed }) => [
              styles.actionWrap,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
            ]}>
            <View style={[styles.mainBtn, { backgroundColor: mainBtn.bg }, styles.actionButton]}>
              {mainBtn.sub ? (
                <>
                  <Text style={[styles.mainLabel, { color: mainBtn.textColor }]}>{mainBtn.label}</Text>
                  <Text style={[styles.mainSub, { color: mainBtn.textColor }]}>{mainBtn.sub}</Text>
                </>
              ) : (
                <Text style={[styles.mainLabelSingle, { color: mainBtn.textColor }]}>{mainBtn.label}</Text>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Résultat de la manche en cours sur ce panneau */}
      {hasCashOutResult && bet && bet.cashedOutAt !== null && (
        <Text style={styles.winText}>
          +{(bet.amount * bet.cashedOutAt).toFixed(2)} XAF encaissés
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#1B1E24",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    overflow: "hidden",
  },
  modeRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#121419",
    borderRadius: 20,
    padding: 3,
    marginBottom: 12,
  },
  modePill: {
    paddingHorizontal: 34,
    paddingVertical: 7,
    borderRadius: 18,
  },
  modePillActive: { backgroundColor: "#2B2E35" },
  modeText: { color: "#8A8C98", fontSize: 13, fontWeight: "600", lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: 10, alignItems: "stretch", minHeight: 124 },
  amountCol: { flex: 1, minWidth: 0, gap: 8 },
  mainButtonColumn: { width: 132, minWidth: 120, alignSelf: "stretch" },
  actionWrap: { width: "100%", flex: 1 },
  actionButton: { borderWidth: 1, borderColor: "rgba(255,255,255,0.42)", borderRadius: 9, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  amountRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#121419", borderRadius: 26, paddingVertical: 6, paddingHorizontal: 4 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#30343D",
    borderWidth: 1,
    borderColor: "#424752",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 3,
    elevation: 4,
  },
  circleText: { color: "#F5F7FA", fontSize: 23, fontWeight: "700", lineHeight: 26, textAlign: "center", includeFontPadding: false },
  amountText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
    minWidth: 70,
    textAlign: "center",
  },
  quickBtn: {
    flex: 1,
    backgroundColor: "#24272E",
    borderRadius: 16,
    paddingVertical: 7,
    alignItems: "center",
  },
  quickText: { color: "#C9CBD4", fontSize: 13, fontWeight: "600", lineHeight: 17 },
  mainBtn: {
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  mainLabel: { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 25, textAlign: "center" },
  quickGrid: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  mainSub: { color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 21, fontVariant: ["tabular-nums"], textAlign: "center" },
  mainLabelSingle: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 30, letterSpacing: 1 },
  winText: { color: "#17C653", fontSize: 12, fontWeight: "700", lineHeight: 17, textAlign: "center", marginTop: 8 },
});
