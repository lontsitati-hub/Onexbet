import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  balance: number;
  controlledCrash?: number | null;
  controlledCrashMax?: number | null;
  /** Nombre de manches restantes sur l’intervalle contrôlé (0 = une seule, -1 = illimité) */
  controlledCrashRounds?: number;
  onAddBalance: (amount: number) => void;
  onSetControlledCrash: (v: number | null, rounds?: number) => void;
  onSetControlledCrashInterval: (min: number | null, max?: number | null, rounds?: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000];
const QUICK_COTES = [1.5, 2, 5, 10, 50, 100];
const QUICK_ROUNDS = [1, 3, 5, 10, 25, 999];

/**
 * Menu Deposit (modal) fidèle à l'esprit Aviator :
 * - Section "Recharger le compte" : montant libre + boutons rapides
 * - Section "Contrôle de cote" : fixer le crash de la prochaine manche
 */
export function DepositMenu({
  visible,
  onClose,
  balance,
  controlledCrash,
  controlledCrashMax,
  controlledCrashRounds,
  onAddBalance,
  onSetControlledCrash,
  onSetControlledCrashInterval,
}: Props) {
  const [amountText, setAmountText] = useState("100");
  const [coteText, setCoteText] = useState("");
  const [maxCoteText, setMaxCoteText] = useState("");
  const [roundsText, setRoundsText] = useState("0");
  const [toast, setToast] = useState<string | null>(null);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleDeposit = () => {
    const n = parseFloat(amountText.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      showNotice("Montant invalide");
      return;
    }
    if (n > 1000000) {
      showNotice("Maximum 1 000 000 par recharge");
      return;
    }
    haptic();
    onAddBalance(n);
    showNotice(`+${n.toLocaleString("fr-FR")} XAF ajoutés au compte`);
  };

  const handleQuickDeposit = (q: number) => {
    haptic();
    onAddBalance(q);
    showNotice(`+${q.toLocaleString("fr-FR")} XAF ajoutés au compte`);
  };

  const applyCote = (v: number | null) => {
    if (v !== null && v < 1.01) {
      showNotice("Cote minimale 1.01×");
      return;
    }
    if (v !== null && v > 100000) {
      showNotice("Cote maximale 100 000×");
      return;
    }
    haptic();
    onSetControlledCrash(v, undefined);
    showNotice(
      v === null ? "Contrôle de cote désactivé" : `Crash de la prochaine manche fixé à ${v.toFixed(2)}×`
    );
    if (v !== null) {
      setTimeout(() => onClose(), 1400);
    }
  };

  const applyCoteWithRounds = (v: number, rounds: number, max = v) => {
    const r = Math.max(0, Math.min(9999, Math.round(rounds)));
    haptic();
    onSetControlledCrashInterval(v, max, r);
    const roundsLabel = r === 0 ? "la prochaine manche" : r === 999 ? `toutes les manches suivantes (jusqu'à désactivation)` : `les ${r} prochaines manches`;
    showNotice(`Intervalle ${v.toFixed(2)}× – ${max.toFixed(2)}× pendant ${roundsLabel}`);
    setTimeout(() => onClose(), 1400);
  };

  const applyCustomRounds = () => {
    const v = controlledCrash ?? null;
    if (v === null) {
      showNotice("Définissez d'abord une cote");
      return;
    }
    const raw = roundsText.trim();
    const r = raw === "∞" ? 999 : parseInt(raw, 10);
    if (raw !== "∞" && (!Number.isInteger(r) || r < 0)) {
      showNotice("Nombre de tours invalide (0 = une seule, nombre positif, ou ∞)");
      return;
    }
    applyCoteWithRounds(v, raw === "∞" ? 999 : r, controlledCrashMax ?? v);
  };

  const applyCustomCote = () => {
    const min = parseFloat(coteText.replace(",", "."));
    const max = parseFloat((maxCoteText || coteText).replace(",", "."));
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1.01 || max < min || max > 100000) {
      showNotice("Intervalle invalide : min ≥ 1.01 et max ≥ min");
      return;
    }
    applyCoteWithRounds(Math.round(min * 100) / 100, Number(roundsText) || 0, Math.round(max * 100) / 100);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <Text style={styles.title}>Menu</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Recharger le compte */}
            <Text style={styles.sectionLabel}>Recharger le compte</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="Montant XAF"
                placeholderTextColor="#6B6E78"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleDeposit}
              />
              <Pressable onPress={handleDeposit} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.actionBtnText}>Recharger</Text>
              </Pressable>
            </View>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => handleQuickDeposit(q)}
                  style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.quickChipText}>+{q}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.balanceLine}>Solde actuel : {balance.toLocaleString("fr-FR")} XAF</Text>

            {/* Contrôle de cote */}
            <Text style={styles.sectionLabel}>Contrôle de cote</Text>
            <Text style={styles.sectionDesc}>
              Entrez un intervalle de crash. À chaque tour, l’avion explosera aléatoirement entre la cote minimale et la cote maximale.
            </Text>

            {(controlledCrash ?? null) !== null && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  INTERVALLE : {Number(controlledCrash).toFixed(2)}× – {Number(controlledCrashMax ?? controlledCrash).toFixed(2)}×{Number(controlledCrashRounds ?? 0) === 999 ? " ∞" : controlledCrashRounds !== undefined && (controlledCrashRounds ?? 0) > 0 ? ` (${controlledCrashRounds} tours restants)` : ""}
                </Text>
              </View>
            )}

            <View style={styles.coteInputRow}>
              <TextInput
                value={coteText}
                onChangeText={setCoteText}
                keyboardType="decimal-pad"
                placeholder="Min : 1.50"
                placeholderTextColor="#6B6E78"
                style={styles.input}
                returnKeyType="next"
              />
              <TextInput
                value={maxCoteText}
                onChangeText={setMaxCoteText}
                keyboardType="decimal-pad"
                placeholder="Max : 5.00"
                placeholderTextColor="#6B6E78"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={applyCustomCote}
              />
              <Pressable onPress={applyCustomCote} style={({ pressed }) => [styles.coteBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.coteBtnText}>Définir</Text>
              </Pressable>
            </View>

            <Text style={styles.roundsLabel}>Nombre de tours sur cet intervalle (0 = une seule fois)</Text>
            <View style={styles.roundsInputRow}>
              <TextInput
                value={roundsText}
                onChangeText={setRoundsText}
                keyboardType="number-pad"
                placeholder="0, 1, 5..."
                placeholderTextColor="#6B6E78"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={applyCustomRounds}
              />
              <Pressable onPress={applyCustomRounds} style={({ pressed }) => [styles.coteBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.coteBtnText}>Appliquer</Text>
              </Pressable>
            </View>
            <View style={styles.quickRow}>
              {QUICK_ROUNDS.map((q) => {
                const r = (controlledCrashRounds ?? 0);
                const active = r === q;
                const label = q === 999 ? "∞ tours" : `${q} tour${q > 1 ? "s" : ""}`;
                return (
                  <Pressable
                    key={q}
                    onPress={() => {
                      const v = controlledCrash ?? null;
                      if (v === null) {
                        showNotice("Définissez d'abord une cote");
                        return;
                      }
                      applyCoteWithRounds(v, q);
                    }}
                    style={({ pressed }) => [
                      styles.quickChip,
                      active && { backgroundColor: "rgba(245,158,11,0.25)" },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Text style={[styles.quickChipText, active && { color: "#F59E0B" }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.quickRow}>
              {QUICK_COTES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => applyCote(c)}
                  style={({ pressed }) => [
                    styles.quickChip,
                    (controlledCrash ?? null) === c && { backgroundColor: "rgba(245,158,11,0.25)" },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.quickChipText, (controlledCrash ?? null) === c && { color: "#F59E0B" }]}>{c}×</Text>
                </Pressable>
              ))}
            </View>
            {(controlledCrash ?? null) !== null && (
              <Pressable
                onPress={() => applyCote(null)}
                style={({ pressed }) => [styles.cancelCtlBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.cancelCtlText}>Désactiver le contrôle de cote</Text>
              </Pressable>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>

        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1B1E24",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: "82%",
  },
  handleWrap: { alignItems: "center", marginBottom: 6 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: "#3A3D46" },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 26, textAlign: "center", marginBottom: 14 },
  sectionLabel: { color: "#8A8C98", fontSize: 12, fontWeight: "800", lineHeight: 16, marginBottom: 8, marginTop: 4, textTransform: "uppercase" },
  sectionDesc: { color: "#8A8C98", fontSize: 12, lineHeight: 17, marginBottom: 10 },
  inputRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  input: {
    flex: 1,
    backgroundColor: "#121419",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    borderWidth: 1,
    borderColor: "#2B2E35",
  },
  actionBtn: {
    backgroundColor: "#17C653",
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "800", lineHeight: 19 },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  quickChip: {
    backgroundColor: "#24272E",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: { color: "#C9CBD4", fontSize: 13, fontWeight: "700", lineHeight: 17 },
  balanceLine: { color: "#17C653", fontSize: 13, fontWeight: "700", lineHeight: 18, marginBottom: 14 },
  activeBadge: {
    backgroundColor: "rgba(245,158,11,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    alignItems: "center",
  },
  activeBadgeText: { color: "#F59E0B", fontSize: 13, fontWeight: "900", lineHeight: 18 },
  coteInputRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  roundsLabel: { color: "#8A8C98", fontSize: 12, fontWeight: "800", lineHeight: 16, marginBottom: 8, textTransform: "uppercase" },
  roundsInputRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  coteBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  coteBtnText: { color: "#0E1014", fontSize: 14, fontWeight: "800", lineHeight: 19 },
  cancelCtlBtn: {
    backgroundColor: "rgba(228,51,30,0.18)",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  cancelCtlText: { color: "#E4331E", fontSize: 13, fontWeight: "800", lineHeight: 18 },
  toast: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: "#28A912",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 18, textAlign: "center" },
});
