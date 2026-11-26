import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
 * - grille de montants rapides 1 / 2 / 5 / 10 (XAF)
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
  const [amountInput, setAmountInput] = useState("1.00");
  const [actionError, setActionError] = useState<string | null>(null);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const adjust = (factor: number) => {
    haptic();
    const next = Math.max(1, Math.round(amount * factor * 100) / 100);
    setAmount(next);
    setAmountInput(next.toFixed(2));
  };

  const setQuick = (q: number) => {
    haptic();
    setAmount(q);
    setAmountInput(q.toFixed(2));
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
    setActionError(null);
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
      if (err) setActionError(err);
      if (!err) haptic();
      return;
    }
    // Après Cash Out, le pari précédent reste dans l’historique mais le panneau
    // redevient disponible ; toute nouvelle mise pendant le vol est anticipée.
    if (phase === "flying" && bet && bet.cashedOutAt !== null && pending === null) {
      const err = onPlacePending(amount);
      if (err) setActionError(err);
      if (!err) haptic();
      return;
    }
    // Vol / crash : placement anticipé pour la prochaine manche
    if ((phase === "flying" || phase === "crashed") && pending === null) {
      const err = onPlacePending(amount);
      if (err) setActionError(err);
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
      if (err) setActionError(err);
      if (!err) haptic();
      return;
    }
    if (phase === "crashed" && bet && bet.cashedOutAt === null) {
      const err = onPlacePending(amount);
      if (err) setActionError(err);
      if (!err) haptic();
      return;
    }
  };

  // --- Rendu du gros bouton selon la phase ---
  const mainBtn = (() => {
    if (phase === "waiting" && bet) {
      return { label: "CANCEL", sub: null, bg: "#1F9C09", textColor: "#fff" };
    }
    if (phase === "waiting" && pending !== null) {
      // Mise anticipée engagée : affichage "En attente" + bouton CANCEL
      return { label: "CANCEL", sub: "Mise prochaine manche", bg: "#1F9C09", textColor: "#fff" };
    }
    // Pendant le vol : le bouton devient ORANGE « CASH OUT » avec le gain
    // potentiel qui augmente en temps réel (comme sur la vidéo officielle)
    if (phase === "flying" && bet && bet.cashedOutAt === null) {
      const cashOutGain = liveMultiplier !== null ? bet.amount * liveMultiplier : bet.amount;
      return {
        label: "CASH OUT",
        sub: `${cashOutGain.toFixed(2)} XAF`,
        bg: "#ffad29",
        textColor: "#fff",
      };
    }
    if (phase === "flying" && bet && bet.cashedOutAt !== null) {
      if (pending !== null) {
        return { label: "CANCEL", sub: "Mise prochaine manche", bg: "#1F9C09", textColor: "#fff" };
      }
      return { label: "Bet", sub: `${amount.toFixed(2)} XAF`, bg: "#1F9C09", textColor: "#fff" };
    }
    if (phase === "flying" && !bet) {
      if (pending !== null) {
        return { label: "CANCEL", sub: "Mise prochaine manche", bg: "#1F9C09", textColor: "#fff" };
      }
      return { label: "Bet", sub: `${amount.toFixed(2)} XAF`, bg: "#1F9C09", textColor: "#fff" };
    }
    if (phase === "crashed" && bet && bet.cashedOutAt !== null) {
      if (pending !== null) {
        return { label: "CANCEL", sub: "Mise prochaine manche", bg: "#1F9C09", textColor: "#fff" };
      }
      return { label: "Bet", sub: `${amount.toFixed(2)} XAF`, bg: "#1F9C09", textColor: "#fff" };
    }
    if (phase === "crashed" && bet && bet.cashedOutAt === null) {
      // « Pas de chance » : le bouton BET reste vert et affiche le solde ;
      // le clic place une mise anticipée pour la prochaine manche.
      if (pending !== null) {
        return { label: "CANCEL", sub: "Mise prochaine manche", bg: "#1F9C09", textColor: "#fff" };
      }
      return { label: "Bet", sub: `${amount.toFixed(2)} XAF`, bg: "#1F9C09", textColor: "#fff" };
    }
    // En attente : BET avec le montant de mise affiché comme dans la référence.
      return { label: "Bet", sub: `${amount.toFixed(2)} XAF`, bg: "#1F9C09", textColor: "#fff" };
  })();

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
            <TextInput
              value={amountInput}
              onChangeText={(value) => {
                const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
                const dotIndex = cleaned.indexOf(".");
                const normalized = dotIndex < 0
                  ? cleaned
                  : cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, "");
                setAmountInput(normalized);
                if (!normalized || normalized === ".") return;
                const parsed = Number(normalized);
                if (Number.isFinite(parsed)) setAmount(Math.round(parsed * 100) / 100);
              }}
              onBlur={() => {
                const parsed = Number(amountInput);
                const normalizedAmount = Math.max(1, Math.round((Number.isFinite(parsed) ? parsed : amount) * 100) / 100);
                setAmount(normalizedAmount);
                setAmountInput(normalizedAmount.toFixed(2));
              }}
              keyboardType="decimal-pad"
              inputMode="decimal"
              selectTextOnFocus
              style={styles.amountText}
              accessibilityLabel="Montant de mise personnalisée"
              accessibilityHint="Touchez pour saisir le montant de votre mise"
            />
            <Pressable
              onPress={() => adjust(2)}
              style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.6 }]}>
              <Text style={styles.circleText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.quickGrid}>
            {[[1, 2], [5, 10]].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.quickGridRow}>
                {row.map((q) => (
                  <Pressable
                    key={q}
                    accessibilityRole="button"
                    accessibilityLabel={`Mise rapide ${q} XAF`}
                    onPress={() => setQuick(q)}
                    style={({ pressed }) => [
                      styles.quickBtn,
                      pressed && styles.quickBtnPressed,
                    ]}>
                    <Text style={styles.quickText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
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

      {actionError && (
        <Text style={styles.actionError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {actionError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#1B1D21",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    overflow: "hidden",
    width: "100%",
    minHeight: 150,
  },
  modeRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#111318",
    borderRadius: 23,
    padding: 3,
    marginBottom: 8,
    minHeight: 34,
  },
  modePill: {
    paddingHorizontal: 28,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 88,
    alignItems: "center",
  },
  modePillActive: { backgroundColor: "#2B2E35" },
  modeText: { color: "#8A8C98", fontSize: 13, fontWeight: "600", lineHeight: 17 },
  // Même principe que Crash Point : des colonnes flexibles qui occupent
  // la largeur disponible, sans largeur fixe dépendante du viewport Android.
  actionRow: { width: "100%", flexDirection: "row", gap: 10, alignItems: "stretch", minHeight: 88 },
  amountCol: { flex: 1.56, minWidth: 0, gap: 5 },
  mainButtonColumn: { flex: 0.87, minWidth: 0, alignSelf: "stretch" },
  actionWrap: { width: "100%", flex: 1, minHeight: 88 },
  actionButton: { borderWidth: 1, borderColor: "rgba(255,255,255,0.42)", borderRadius: 9, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  actionError: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: "#85404A", backgroundColor: "#3B2025", paddingHorizontal: 10, paddingVertical: 7, color: "#FFD0D5", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#121419", borderRadius: 22, paddingVertical: 4, paddingHorizontal: 6 },
  circleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2B2E35",
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: { color: "#fff", fontSize: 20, fontWeight: "600", lineHeight: 24 },
  amountText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "center",
  },
  quickGridRow: { flex: 1, flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    backgroundColor: "#3A3D46",
    borderRadius: 6,
    minHeight: 28,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnPressed: { opacity: 0.62 },
  quickText: { color: "#C9CBD4", fontSize: 12, fontWeight: "500", lineHeight: 16 },
  mainBtn: {
    width: "100%",
    flex: 1,
    minHeight: 88,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  mainLabel: { color: "#fff", fontSize: 21, fontWeight: "500", lineHeight: 25, textAlign: "center" },
  quickGrid: { flex: 1, flexDirection: "column", gap: 3 },
  mainSub: { color: "#fff", fontSize: 20, fontWeight: "500", lineHeight: 25, fontVariant: ["tabular-nums"], textAlign: "center" },
  mainLabelSingle: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 30, letterSpacing: 1 },
  winText: { color: "#17C653", fontSize: 12, fontWeight: "700", lineHeight: 17, textAlign: "center", marginTop: 8 },
});
