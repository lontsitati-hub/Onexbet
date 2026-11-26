import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { crashTokenColor } from "@/services/aviatorLogic";

/** Couleurs des jetons d'historique fidèles à la maquette Aviator officielle */
const TOKEN_COLORS = {
  red: { bg: "rgba(74,144,226,0.18)", text: "#5A9FE8" }, // <2x : bleu clair
  blue: { bg: "rgba(74,100,226,0.22)", text: "#7B8FF0" }, // 2-10x : bleu
  pink: { bg: "rgba(160,80,230,0.25)", text: "#C084F0" }, // >10x : violet/rose
};

export function HistoryStrip({ sessions }: { sessions: Array<{ id: string; crashPoint: number }> }) {
  return (
    <View style={{ maxHeight: 34, backgroundColor: "#0E1014" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {sessions.slice(0, 30).map((s, i) => {
          const color = TOKEN_COLORS[crashTokenColor(s.crashPoint)];
          return (
            <View key={s.id} style={[styles.token, { backgroundColor: color.bg }]}>
              <Text style={[styles.tokenText, { color: color.text }]}>
                {s.crashPoint.toFixed(2)}x
              </Text>
            </View>
          );
        })}
        {sessions.length === 0 && (
          <Text style={{ color: "#8A8C98", fontSize: 11, lineHeight: 16 }}>
            Aucune partie jouée
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  token: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 13,
  },
  tokenText: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
});
