import { getBackgroundPalette } from '@/constants/theme';
import { useBetStore } from '@/store/useBetStore';
import {
  getMessages,
  markMessagesAsRead,
  type WithdrawalMessage
} from '@/services/withdrawals';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '@/services/withdrawals';
import { checkAccess } from '@/services/access';
import { Alert } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Écran Messagerie — notifications des retraits (reçue / approuvée / refusée)
// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);

  const activeColor =
    theme === 'red_mega'
      ? '#E60000' : theme === 'light_green'
      ? '#7CB342'
      : theme === 'green'
        ? '#008264'
        : theme === 'royal_blue'
          ? '#2e45d1'
          : theme === 'gold'
            ? '#E5A93B'
            : '#2E79C9';

  const [messages, setMessages] = useState<WithdrawalMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMessages = useCallback(async () => {
    const list = await getMessages();
    setMessages(list);
    await markMessagesAsRead();
    return list;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const access = checkAccess('/messages');
      if (!access.allowed) {
        if (access.reason === 'no-session') {
          router.replace('/');
        } else {
          Alert.alert('Accès refusé', access.message, [{ text: 'OK', onPress: () => router.replace('/') }]);
        }
        return;
      }
      void loadMessages();
    }, [loadMessages])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }, [loadMessages]);

  const typeConfig: Record<WithdrawalMessage['type'], { icon: any; color: string; bgTint: string }> = {
    pending: { icon: 'clock-outline', color: '#F5B041', bgTint: '#FEF8EC' },
    approved: { icon: 'check-circle-outline', color: '#27BE6D', bgTint: '#E9F9EF' },
    rejected: { icon: 'close-circle-outline', color: '#E74C3C', bgTint: '#FBEAEA' },
    deposit: { icon: 'cash-plus', color: '#2E79C9', bgTint: '#EAF3FF' },
  };

  return (
    <View style={[styles.container, { backgroundColor: bg.appBg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={activeColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <FontAwesome name="envelope" size={18} color={activeColor} />
          <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Messagerie</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColor} />}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <FontAwesome name="envelope" size={44} color={bg.textMuted} />
            <Text style={[styles.emptyText, { color: bg.textSecondary }]}>Aucun message</Text>
            <Text style={[styles.emptySub, { color: bg.textMuted }]}>
              Les notifications de vos retraits apparaîtront ici.
            </Text>
          </View>
        ) : (
          messages.map((m) => {
            const cfg = typeConfig[m.type];
            return (
              <View
                key={m.id}
                style={[
                  styles.msgCard,
                  { backgroundColor: bg.cardBg, borderColor: bg.border },
                  !m.read && styles.unreadCard,
                ]}
              >
                <View style={[styles.msgIconRow, { backgroundColor: cfg.bgTint }]}>
                  <MaterialCommunityIcons name={cfg.icon as any} size={24} color={cfg.color} />
                </View>
                <View style={styles.msgBody}>
                  <View style={styles.msgTitleRow}>
                    <Text style={[styles.msgTitle, { color: bg.textPrimary }]}>{m.title}</Text>
                    {!m.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
                  </View>
                  <Text style={[styles.msgText, { color: bg.textSecondary }]}>{m.body}</Text>
                  <Text style={[styles.msgDate, { color: bg.textMuted }]}>{formatDate(m.createdAt)}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scrollContent: { padding: 16, gap: 12 },
  emptyWrap: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 80,
  },
  emptyText: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  msgCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  unreadCard: {
    borderWidth: 1.5,
  },
  msgIconRow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgBody: { flex: 1, gap: 3 },
  msgTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  msgTitle: { fontSize: 14.5, fontWeight: '800', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  msgText: { fontSize: 13, lineHeight: 18 },
  msgDate: { fontSize: 11.5, fontWeight: '600' },
  bottomSpacer: { height: 24 },
});
