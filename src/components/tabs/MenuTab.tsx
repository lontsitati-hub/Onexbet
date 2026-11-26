import { COLORS, SPACING, getBackgroundPalette } from '@/constants/theme';
import { logoutFirebase } from '@/services/firebase';
import { resetFastGamesFirebase } from '@/services/fastGamesAccessFirebase';
import { useBetStore } from '@/store/useBetStore';
import { getThemeAccentColor } from '@/constants/themeBranding';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Animated, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const menuNavigation = [
  { id: 'populaire', label: 'Populaires', icon: require('@/assets/images/video-reference-icons/top-populaires-transparent-4x.png') },
  { id: 'sports', label: 'Sports', icon: require('@/assets/images/video-reference-icons/top-sports-transparent-4x.png') },
  { id: 'esport', label: 'E-sport', icon: require('@/assets/images/video-reference-icons/top-esport-transparent-4x.png') },
  { id: 'casino', label: 'Casino', icon: require('@/assets/images/video-reference-icons/top-casino-transparent-4x.png') },
  { id: 'games', label: '1xGames', icon: require('@/assets/images/video-reference-icons/top-1xgames-transparent-4x.png') },
] as const;

export default function MenuTab() {
  const insets = useSafeAreaInsets();
  const balance = useBetStore((state) => state.balance);
  const setActiveTab = useBetStore((state) => state.setActiveTab);
  const router = useRouter();
  const theme = useBetStore((state) => state.theme);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const bg = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const assistanceIconScale = React.useMemo(() => new Animated.Value(1), []);
  const onAssistancePressIn = React.useCallback(() => Animated.spring(assistanceIconScale, { toValue: 0.88, useNativeDriver: true, speed: 45, bounciness: 5 }).start(), [assistanceIconScale]);
  const onAssistancePressOut = React.useCallback(() => Animated.spring(assistanceIconScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7 }).start(), [assistanceIconScale]);

  const activeColor = getThemeAccentColor(theme);
  const activeBgColor =
    theme === 'red_mega'
      ? '#FFF5F5' : theme === 'light_green'
      ? '#F2F9E6'
      : theme === 'green'
        ? '#E6F2EF'
        : theme === 'royal_blue'
          ? '#E8EAFA'
          : theme === 'gold'
            ? '#FEF8EC'
            : '#EBF3FC';

  const sessionUser = useBetStore((state) => state.sessionUser);
  const sessionRole = useBetStore((state) => state.sessionRole);
  // Le profil affiche uniquement le nom : aucun @, domaine e-mail ou rôle.
  const displayUserName = String(sessionUser || '')
    .trim()
    .replace(/^@+/, '')
    .split('@')[0]
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();


  // Badge dynamique : nombre de notifications de retraits non lues
  const [unreadMessages, setUnreadMessages] = useState(0);

  React.useEffect(() => {
    // Rafraîchit le badge toutes les 5 secondes pour afficher les nouvelles
    // notifications d'approbation de retraits en temps réel.
    let alive = true;
    const poll = async () => {
      try {
        const { getMessages, getUnreadCount } = await import('@/services/withdrawals');
        const messages = await getMessages();
        if (alive) setUnreadMessages(getUnreadCount(messages));
      } catch (_) {
        // Pas de notifications — badge masqué
      }
    };
    void poll();
    const interval = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    try {
      useBetStore.getState().loadFromDb();
    } catch (e) {
      console.warn('Failed to refresh menu:', e);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const formatCurrency = (val: number) => {
    if (val % 1 !== 0) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  const completeLogout = async () => {
    // Verrouiller d’abord l’interface : le passage à l’écran de connexion ne
    // dépend pas de la vitesse de Firestore ou du réseau.
    const store = useBetStore.getState();
    store.setIsUnlocked(false);
    store.setSessionUser(null, null);
    resetFastGamesFirebase();
    try {
      await logoutFirebase();
    } catch (err) {
      console.error('Logout error:', err);
    }
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem('onexbet:local-admin-session:v1');
    } catch (_) {
      /* AsyncStorage indisponible */
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      void completeLogout();
      return;
    }
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter de votre compte ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => { void completeLogout(); } },
    ]);
  };

  // Tous les utilisateurs connectés accèdent au panneau administratif.
  // Seule la gestion des utilisateurs reste réservée au rôle admin.
  const handleDepositOrAdmin = () => {
    router.push('/admin');
  };

  const handleMenuNavigation = (id: (typeof menuNavigation)[number]['id']) => {
    // Les icônes du header Menu ouvrent exactement les mêmes vues que les
    // onglets correspondants du header de PopularTab.
    setActiveTab('populaire');
    router.replace({ pathname: '/', params: { topTab: id } } as any);
  };

  const handleConfirmDeposit = () => {
    // Le joueur peut recharger son propre compte depuis la modale "Effectuer un dépôt".
    // L'admin conserve en plus l'entrée "Administration" (bandeau solde) et le
    // contrôle de cote dans Aviator.
    const amt = parseFloat(depositAmount);
    if (!isNaN(amt) && amt > 0) {
      const currentBal = useBetStore.getState().balance;
      useBetStore.getState().updateBalance(currentBal + amt);
      void import('@/services/withdrawals').then(({ addDepositMessage }) => addDepositMessage(amt));
      setDepositAmount('');
      setDepositModalVisible(false);
      Alert.alert('Succès', `Votre compte a été rechargé de ${formatCurrency(amt)}₣.`);
    } else {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg.appBg }]}>
      <StatusBar barStyle={bg.statusBarStyle} backgroundColor="transparent" translucent={true} />
      {/* Header Menu : structure et position du solde conservées */}
      <View style={[styles.profileHeader, { paddingTop: (insets.top || 44) + 8, backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}> 
        <View style={styles.profileRow}>
          {/* Avatar and User ID */}
          <View style={styles.profileLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: bg.appBg }]}>
              <FontAwesome name="user" size={22} color={bg.textSecondary} />
            </View>
            <View style={styles.idContainer}>
              <Text style={[styles.idText, { color: bg.textPrimary }]}>
                {displayUserName || 'Utilisateur'}
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/settings')} accessibilityRole="button">
                <Text style={[styles.profileLink, { color: activeColor }]}>Profil personnel</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Actions */}
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={styles.iconBadgeBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/messages')}
            >
              <FontAwesome name="envelope" size={20} color={activeColor} />
              {unreadMessages > 0 && (
                <View style={styles.redBadge}>
                  <Text style={styles.badgeText}>{unreadMessages > 99 ? '99+' : String(unreadMessages)}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBadgeBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/settings')}
            >
              <FontAwesome name="cog" size={22} color={activeColor} />
              <View style={styles.redBadge}>
                <Text style={styles.badgeText}>!</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance and Deposit Row */}
        <View style={styles.balanceRow}>
          <TouchableOpacity style={[styles.balanceDropdown, { backgroundColor: activeBgColor }]} activeOpacity={0.8}>
            <Image source={require('@/assets/images/menu-balance-access.png')} style={styles.balanceAsset} resizeMode="cover" accessibilityLabel="Accès du solde" />
            <Text style={[styles.balanceValue, { color: bg.textPrimary }]}>{formatCurrency(balance)} ₣</Text>
            <FontAwesome name="chevron-down" size={14} color={activeColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.depositButton, { backgroundColor: activeColor }]}
            activeOpacity={0.85}
            onPress={handleDepositOrAdmin}
          >
            <Text style={styles.depositText}>
              {sessionRole === 'admin' ? 'Administration' : 'Déposer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation haute : mêmes assets que Populaire */}
      <View style={[styles.menuTabsContainer, { backgroundColor: bg.headerBg, borderBottomColor: bg.divider }]}> 
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuTabsScroll}>
          {menuNavigation.map((item) => {
            const isActive = item.id === 'populaire';
            const itemColor = isActive ? activeColor : bg.textSecondary;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuTab}
                activeOpacity={0.7}
                onPress={() => handleMenuNavigation(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Image source={item.icon} style={[styles.menuTabIcon, { tintColor: itemColor }]} resizeMode="contain" />
                <Text style={[styles.menuTabText, isActive && styles.activeMenuTabText, { color: itemColor }]}>{item.label}</Text>
                {isActive && <View style={[styles.activeMenuIndicator, { backgroundColor: activeColor }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List of Action Cards */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: bg.appBg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[activeColor]}
            tintColor={activeColor}
          />
        }
      >
        {/* Image originale fournie par l'utilisateur : transparence conservée,
            aucun fond ni visuel de remplacement ajouté. */}
        <TouchableOpacity
          style={styles.championshipAccess}
          activeOpacity={0.85}
          onPress={() => router.push('/championships')}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les championnats"
        >
          <Image
            source={require('@/assets/images/championship-access-original-trimmed.png')}
            style={styles.championshipAccessImage}
            resizeMode="contain"
            accessibilityLabel="Accès aux championnats"
          />
        </TouchableOpacity>
        {/* Card 1: EN DIRECT */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85}>
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <MaterialCommunityIcons name="timer-outline" size={20} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>EN DIRECT</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Pariez sur les événements en direct</Text>
          </View>
        </TouchableOpacity>

        {/* Card 2: Avant-match */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85}>
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <Ionicons name="calendar-outline" size={20} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Avant-match</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Pariez sur les événements à venir</Text>
          </View>
        </TouchableOpacity>

        {/* Card 3: E-sport */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85}>
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <Ionicons name="game-controller-outline" size={20} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>E-sport</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Les meilleurs événements d&apos;e-sport</Text>
          </View>
        </TouchableOpacity>

        {/* Card 4: Machines à sous */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85} onPress={() => router.push('/casino')}>
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <MaterialCommunityIcons name="fruit-cherries" size={20} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Machines à sous</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Les meilleures machines à sous</Text>
          </View>
        </TouchableOpacity>

        {/* Card 5: Casino En Direct */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85} onPress={() => router.push('/casino')}>
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <MaterialCommunityIcons name="cards-spade" size={20} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Casino En Direct</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Ressentez l&apos;impression d&apos;être au casino</Text>
          </View>
        </TouchableOpacity>

        {/* Card 7: Codes promo (Teal card) */}
        <TouchableOpacity style={[styles.menuCard, styles.promoCard]} activeOpacity={0.85}>
          <View style={styles.promoLeft}>
            <View style={styles.promoIconContainer}>
              <FontAwesome name="shopping-cart" size={18} color="#3BB7C4" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.promoTitle}>Codes promo</Text>
              <Text style={styles.promoSubtitle}>Points promo : 0 PTS</Text>
            </View>
          </View>
          <Ionicons name="basket-outline" size={44} color="rgba(255,255,255,0.25)" style={styles.promoIllus} />
        </TouchableOpacity>

        {/* Mon Panel — accessible à tous les utilisateurs connectés */}
        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: bg.cardBg }]}
          activeOpacity={0.85}
          onPress={() => router.push('/admin')}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <MaterialCommunityIcons name="view-dashboard-outline" size={18} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Mon Panel</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Matches, coupons, retraits et plus</Text>
          </View>
        </TouchableOpacity>

        {/* Subscription card — utilisateurs uniquement, lecture seule */}
        {sessionRole !== 'admin' && (
          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: bg.cardBg }]}
            activeOpacity={0.85}
            onPress={() => router.push('/mon-abonnement')}
          >
            <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
              <Ionicons name="calendar-outline" size={20} color={activeColor} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Mon abonnement</Text>
              <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Consulter votre durée et votre échéance</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* User Management card — Admin uniquement */}
        {sessionRole === 'admin' && (
          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: bg.cardBg }]}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/admin', params: { initialTab: 'users' } })}
          >
            <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
              <FontAwesome name="users" size={18} color={activeColor} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Gestion des Utilisateurs</Text>
              <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Activer, suspendre et supprimer des comptes</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Card 8: Assistance client */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85} onPressIn={onAssistancePressIn} onPressOut={onAssistancePressOut} accessibilityRole="button">
          <Animated.View style={[styles.cardIconContainer, { backgroundColor: activeBgColor, transform: [{ scale: assistanceIconScale }] }]}>
            <Ionicons name="headset-outline" size={20} color={activeColor} />
          </Animated.View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Assistance</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Contactez-nous, nous vous aiderons</Text>
          </View>
        </TouchableOpacity>

        {/* Card 9: Authentificateur */}
        <TouchableOpacity style={[styles.menuCard, { backgroundColor: bg.cardBg }]} activeOpacity={0.85}>
          <View style={[styles.cardIconContainer, { backgroundColor: activeBgColor }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={activeColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: bg.textPrimary }]}>Authentificateur</Text>
            <Text style={[styles.cardSubtitle, { color: bg.textSecondary }]}>Protégez votre compte</Text>
          </View>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.menuCard, { borderColor: '#FCA5A5', borderWidth: 1, backgroundColor: backgroundMode === 'light' ? '#FEF2F2' : 'rgba(220,38,38,0.12)' }]}
          activeOpacity={0.85}
          onPress={handleLogout}
        >
          <View style={[styles.cardIconContainer, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#DC2626' }]}>Se déconnecter</Text>
            <Text style={styles.cardSubtitle}>Quitter la session actuelle</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modal de dépôt — Compatible Android */}
      <Modal
        visible={depositModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: bg.cardBg, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: bg.divider }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: bg.textPrimary, marginBottom: 6 }}>Recharger le compte</Text>
            <Text style={{ fontSize: 14, color: bg.textSecondary, marginBottom: 16 }}>Entrez le montant à recharger (₣) :</Text>
            <TextInput
              value={depositAmount}
              onChangeText={setDepositAmount}
              keyboardType="numeric"
              placeholder="Ex: 1000"
              placeholderTextColor={bg.textSecondary}
              autoFocus
              style={{
                borderWidth: 1,
                borderColor: bg.divider,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 16,
                color: bg.textPrimary,
                backgroundColor: bg.appBg,
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDepositModalVisible(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: bg.divider, alignItems: 'center' }}
              >
                <Text style={{ color: bg.textSecondary, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDeposit}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: activeColor, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Recharger</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
 
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  balanceAsset: {
    width: 34,
    height: 32,
    borderRadius: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F6F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  idContainer: {
    justifyContent: 'center',
  },
  idText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkBlue,
    fontFamily: 'System',
  },
  profileLink: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'System',
    marginTop: 1,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBadgeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  redBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: 'System',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  balanceDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF2FC',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  balanceValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkBlue,
    fontFamily: 'System',
  },
  depositButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2FC46E',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  addIcon: {
    top: 0.5,
  },
  depositText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'System',
  },
  menuTabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DFE7F0',
  },
  menuTabsScroll: {
    paddingHorizontal: SPACING.md,
    height: 48,
    alignItems: 'stretch',
  },
  menuTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    position: 'relative',
    gap: 6,
  },
  menuTabIcon: {
    width: 24,
    height: 20,
  },
  activeMenuTab: {},
  menuTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#758C9E',
    fontFamily: 'System',
  },
  activeMenuTabText: {
    fontWeight: '700',
  },
  activeMenuIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2.5,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 24,
    rowGap: 10,
  },
  championshipAccess: {
    width: '100%',
    aspectRatio: 1085 / 1188,
    alignItems: 'center',
    justifyContent: 'center',
  },
  championshipAccessImage: {
    width: '100%',
    height: '100%',
  },
  menuCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.015,
    shadowRadius: 2,
    elevation: 0.5,
  },
  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4EEF9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkBlue,
    fontFamily: 'System',
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#758C9E',
    fontWeight: '500',
    fontFamily: 'System',
    marginTop: 1,
  },
  swipeCard: {
    justifyContent: 'space-between',
  },
  swipeLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  swipeIllustration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -12,
  },
  illusCard: {
    width: 44,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  illusCardBlue: {
    backgroundColor: '#3B82F6',
    transform: [{ rotate: '-8deg' }],
  },
  illusCardGreen: {
    backgroundColor: '#10B981',
    transform: [{ rotate: '8deg' }],
  },
  illusText: {
    fontSize: 8.5,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  promoCard: {
    width: '100%',
    backgroundColor: '#3BB7C4',
  },
  promoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  promoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  promoSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontFamily: 'System',
    marginTop: 1,
  },
  promoIllus: {
    position: 'absolute',
    right: 12,
    bottom: -4,
  },
  bottomSpacer: {
    height: 20,
  },
  lockBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(228,51,30,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
