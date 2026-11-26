import { getBackgroundPalette } from '@/constants/theme';
import { getSubscriptionNow, subscribeToMySubscription } from '@/services/subscriptionAccess';
import { useBetStore } from '@/store/useBetStore';
import { SUBSCRIPTION_DAY_MS, type SubscriptionInfo } from '@/utils/subscription';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(ms: number | null) {
  return ms === null ? '—' : dateFormatter.format(new Date(ms));
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const accent = theme === 'red_mega' ? '#E60000' : theme === 'light_green' ? '#7CB342' : theme === 'green' ? '#008264' : theme === 'royal_blue' ? '#2e45d1' : theme === 'gold' ? '#E5A93B' : '#2E79C9';

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [nowMs, setNowMs] = useState(() => getSubscriptionNow());

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsubscribe = subscribeToMySubscription((nextInfo, errorMessage) => {
      if (errorMessage) {
        setError(errorMessage);
        setInfo(null);
        setLoading(false);
        return;
      }
      setError('');
      setNowMs(getSubscriptionNow());
      setInfo(nextInfo);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [reloadKey]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(getSubscriptionNow()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const displayInfo = useMemo(() => {
    if (!info) return null;
    if (info.expiresAtMs === null) return info;
    return {
      ...info,
      remainingDays: Math.max(0, Math.ceil((info.expiresAtMs - nowMs) / SUBSCRIPTION_DAY_MS)),
      state: nowMs >= info.expiresAtMs ? 'expired' as const : info.state,
    };
  }, [info, nowMs]);

  const isLegacy = displayInfo?.state === 'not_configured';
  const isExpired = displayInfo?.state === 'expired';
  const isSuspended = displayInfo?.state === 'suspended';
  const isAdmin = displayInfo?.state === 'admin';

  return (
    <View style={[styles.root, { backgroundColor: bg.appBg }]}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor={bg.headerBg} />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color={bg.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: bg.textPrimary }]}>Mon abonnement</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.stateText, { color: bg.textSecondary }]}>Chargement de votre abonnement…</Text>
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: bg.cardBg, borderColor: bg.border }]}>
            <Ionicons name="cloud-offline-outline" size={36} color="#C2410C" />
            <Text style={[styles.stateTitle, { color: bg.textPrimary }]}>Abonnement indisponible</Text>
            <Text style={[styles.stateText, { color: bg.textSecondary }]}>{error}</Text>
            <Pressable style={[styles.retryButton, { backgroundColor: accent }]} onPress={() => setReloadKey((key) => key + 1)}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : !displayInfo ? (
          <View style={[styles.stateCard, { backgroundColor: bg.cardBg, borderColor: bg.border }]}>
            <Ionicons name="help-circle-outline" size={36} color="#C2410C" />
            <Text style={[styles.stateTitle, { color: bg.textPrimary }]}>Informations indisponibles</Text>
            <Text style={[styles.stateText, { color: bg.textSecondary }]}>Contactez l’administrateur pour vérifier votre accès.</Text>
            <Pressable style={[styles.retryButton, { backgroundColor: accent }]} onPress={() => setReloadKey((key) => key + 1)}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: bg.cardBg, borderColor: bg.border }]}>
              <View style={[styles.heroIcon, { backgroundColor: bg.pillBg }]}>
                <Ionicons name={isExpired ? 'alert-circle-outline' : isSuspended ? 'pause-circle-outline' : 'calendar-outline'} size={28} color={isExpired || isSuspended ? '#C2410C' : accent} />
              </View>
              <Text style={[styles.heroLabel, { color: bg.textSecondary }]}>État de l’abonnement</Text>
              <Text style={[styles.heroStatus, { color: isExpired || isSuspended ? '#C2410C' : '#27BE6D' }]}>
                {isAdmin ? 'Compte administrateur' : isExpired ? 'Expiré' : isSuspended ? 'Suspendu' : isLegacy ? 'Durée non définie' : 'Actif'}
              </Text>
              {isLegacy && <Text style={[styles.legacyText, { color: bg.textSecondary }]}>Durée non définie — contactez administrateur</Text>}
              {!isAdmin && !isLegacy && !isExpired && !isSuspended && (
                <Text style={[styles.remaining, { color: bg.textPrimary }]}>
                  {displayInfo.remainingDays ?? 0} jour{displayInfo.remainingDays === 1 ? '' : 's'} restant{displayInfo.remainingDays === 1 ? '' : 's'}
                </Text>
              )}
            </View>

            {!isAdmin && !isLegacy && (
              <View style={[styles.detailsCard, { backgroundColor: bg.cardBg, borderColor: bg.border }]}>
                <View style={[styles.detailRow, { borderBottomColor: bg.divider }]}>
                  <Text style={[styles.detailLabel, { color: bg.textSecondary }]}>Début (date/heure)</Text>
                  <Text style={[styles.detailValue, { color: bg.textPrimary }]}>{formatDate(displayInfo.startsAtMs)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: bg.textSecondary }]}>Fin (date/heure)</Text>
                  <Text style={[styles.detailValue, { color: bg.textPrimary }]}>{formatDate(displayInfo.expiresAtMs)}</Text>
                </View>
              </View>
            )}

            <View style={[styles.contactCard, { backgroundColor: bg.cardBg, borderColor: bg.border }]}>
              <Ionicons name="information-circle-outline" size={22} color={accent} />
              <View style={styles.contactCopy}>
                <Text style={[styles.contactTitle, { color: bg.textPrimary }]}>Besoin d’une modification ?</Text>
                <Text style={[styles.contactText, { color: bg.textSecondary }]}>Le renouvellement et l’activation sont réservés à l’administrateur. Contactez-le pour prolonger votre accès.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: 40 },
  content: { padding: 16, paddingBottom: 34, gap: 14 },
  centerState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateCard: { minHeight: 230, borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 17, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  retryButton: { marginTop: 18, backgroundColor: '#4C86C6', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 9 },
  retryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  heroCard: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center' },
  heroIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatus: { fontSize: 24, fontWeight: '900', marginTop: 5, textAlign: 'center' },
  remaining: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  legacyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  detailsCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  detailRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, gap: 12 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '800', textAlign: 'right' },
  contactCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 12 },
  contactCopy: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  contactText: { fontSize: 12.5, lineHeight: 18 },
});
