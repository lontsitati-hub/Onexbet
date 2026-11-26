import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { crashTokenColor, formatMultiplier } from "./gameLogic";

const COLORS = {
  red: { bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
  blue: { bg: "rgba(59,130,246,0.15)", text: "#60A5FA" },
  pink: { bg: "rgba(236,72,153,0.18)", text: "#F472B6" },
};

export function CrashHistoryStrip({ history }: { history: number[] }) {
  return (
    <View style={{ maxHeight: 34 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {history.slice(0, 40).map((c, i) => {
          const color = COLORS[crashTokenColor(c)];
          return (
            <View key={`${c}-${i}`} style={[styles.token, { backgroundColor: color.bg }]}>
              <Text style={[styles.tokenText, { color: color.text }]}>
                {formatMultiplier(c)}
              </Text>
            </View>
          );
        })}
        {history.length === 0 && (
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
    gap: 4,
    paddingHorizontal: 8,
  },
  token: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tokenText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
});
