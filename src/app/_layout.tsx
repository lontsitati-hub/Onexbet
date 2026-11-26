import { generateAndSaveSessionId, initDatabase } from "@/services/db";
import { useBetStore } from "@/store/useBetStore";
import { getBackgroundPalette } from "@/constants/theme";
import { ThemeSplash } from '@/components/branding/theme-splash';
import { loginFirebase, listenToAuthSession, registerActiveDevice } from "@/services/firebase";
import { initFastGamesFirebase, resetFastGamesFirebase } from "@/services/fastGamesAccessFirebase";
import { isMortalKombatEvent, isMortalKombatStartDue } from "@/utils/localMortalKombatSimulation";
import { isPokerEvent, isPokerStartDue } from '@/utils/localPokerSimulation';
import { FontAwesome, FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Font from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import { prefetchAppRoutes } from "@/services/gameLaunchRoutes";
import { useEffect, useRef, useState } from "react";
import { 
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  LogBox, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Ignore linking/navigation state warnings on early mount
LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
]);

interface AuthScreenProps {
  onLoginSuccess: (username: string, role: string, uid: string) => void;
  accessError?: string;
}

const RETRYABLE_AUTH_SPLASH_TIMEOUT_MS = 15_000;

function PwaHead() {
  return (
    <Head>
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="1xbet.cm" />
      <meta name="theme-color" content="#03346D" />
    </Head>
  );
}

function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const theme = useBetStore((state) => state.theme);
  return (
    <>
      <PwaHead />
      <ThemeSplash theme={theme} onComplete={onComplete} />
    </>
  );
}

function AuthScreen({ onLoginSuccess, accessError }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleAction = async () => {
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs.");
      return;
    }

    setActionLoading(true);
    setLoginError('');
    setLoadingMessage("Connexion en cours...");

    try {
      const user = await loginFirebase(cleanUser, cleanPass);
      setActionLoading(false);
      onLoginSuccess(user.username, user.role, user.uid);
    } catch (e: any) {
      setActionLoading(false);
      console.error(e);
      let errMsg = e.message || "Une erreur inconnue est survenue.";
      if (errMsg.includes("apiKey") || errMsg.includes("VOTRE_API_KEY") || errMsg.includes("auth-config") || errMsg.includes("bad-config")) {
        errMsg = "Veuillez d'abord renseigner vos clés de configuration Firebase réelles dans le fichier :\n\nsrc/services/firebase.ts";
      } else if (e.code === 'auth/session-already-active' || e.code === 'auth/device-already-bound') {
        errMsg = "Ce compte est déjà utilisé sur un autre appareil. Déconnectez-le avant de vous connecter ici.";
      } else if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        errMsg = "Nom d'utilisateur ou mot de passe incorrect.";
      } else if (e.code === 'auth/email-already-in-use') {
        errMsg = "Ce nom d'utilisateur est déjà pris.";
      } else if (e.code === 'auth/weak-password') {
        errMsg = "Le mot de passe doit comporter au moins 6 caractères.";
      }
      setLoginError(errMsg);
      Alert.alert("Erreur", errMsg);
    }
  };

  return (
    <>
    <PwaHead />
    <KeyboardAvoidingView
      style={authStyles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={require('../../assets/images/login-reference-top.png')}
        style={authStyles.patternArea}
        resizeMode="cover"
      />
      <ScrollView
        style={authStyles.authPanel}
        contentContainerStyle={authStyles.authPanelContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={authStyles.title}>Autorisation</Text>
        {!!accessError && (
          <Text accessibilityRole="alert" style={{ color: '#8B3A2E', backgroundColor: '#FFF1ED', padding: 10, borderRadius: 8, marginBottom: 16, lineHeight: 20 }}>
            {accessError}
          </Text>
        )}
        {!!loginError && <Text accessibilityRole="alert" style={{ color: '#FFE1A6', marginBottom: 16, lineHeight: 21 }}>{loginError}</Text>}

        <View style={authStyles.inputGroup}>
          <Text style={authStyles.label}>E-mail ou ID</Text>
          <View style={authStyles.inputLineRow}>
            <TextInput
              style={authStyles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="E-mail ou ID"
              placeholderTextColor="#5E7F99"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <View style={authStyles.inputActionBadge}>
              <Ionicons name="phone-portrait-outline" size={29} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={authStyles.inputGroup}>
          <Text style={authStyles.label}>Mot de passe</Text>
          <View style={authStyles.inputLineRow}>
            <TextInput
              style={authStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor="#5E7F99"
              secureTextEntry={secureText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={authStyles.eyeButton} onPress={() => setSecureText(!secureText)}>
              <Ionicons name={secureText ? 'eye-off-outline' : 'eye-outline'} size={22} color="#5E7F99" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={authStyles.button} onPress={handleAction} activeOpacity={0.8}>
          {actionLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={authStyles.buttonText}>Se connecter</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={authStyles.forgotButton} activeOpacity={0.75} onPress={() => Alert.alert('Mot de passe oublié ?', 'Contactez l’administrateur pour réinitialiser votre accès.') }>
          <Text style={authStyles.forgotText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        <View style={authStyles.supportIcon}>
          <FontAwesome name="headphones" size={30} color="#FFFFFF" />
        </View>
        <Text style={authStyles.registrationText}>
          Pas de compte ? <Text style={authStyles.registrationLink}>Contactez l’administrateur</Text>
        </Text>
      </ScrollView>

      {actionLoading && (
        <View style={authStyles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={authStyles.loadingText}>{loadingMessage}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
    </>
  );
}

export default function RootLayout() {
  const isUnlocked = useBetStore((state) => state.isUnlocked);
  const theme = useBetStore((state) => state.theme);
  const localAofPreview = process.env.EXPO_PUBLIC_AOF_PREVIEW === '1';
  const pathname = usePathname();
  const visualQaRoute = __DEV__ && localAofPreview && (
    pathname === '/splash-preview' ||
    (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname === '/splash-preview')
  );
  const setIsUnlocked = useBetStore((state) => state.setIsUnlocked);
  const backgroundMode = useBetStore((state) => state.backgroundMode);
  const backgroundOpacity = useBetStore((state) => state.backgroundOpacity);
  const rootPalette = getBackgroundPalette(backgroundMode, backgroundOpacity);
  const [loading, setLoading] = useState(true);
  const [splashThemeReady, setSplashThemeReady] = useState(false);
  const splashAnimationComplete = useRef(false);
  const startupReady = useRef(false);
  const iconFontsReady = useRef(false);
  const [themeSplashVisible, setThemeSplashVisible] = useState(false);
  const previousTheme = useRef(theme);
  const betHistory = useBetStore((state) => state.betHistory);
  const [accessError, setAccessError] = useState('');
  const deviceHeartbeat = useRef<{ uid: string; stop?: () => void; generation: number }>({ uid: '', generation: 0 });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/offline-sw.js').catch((error) => {
      // Le service worker est une optimisation PWA : il ne doit jamais bloquer
      // l’ouverture de l’application si l’hébergeur ne l’autorise pas.
      console.warn('Service worker hors connexion indisponible:', error);
    });
  }, []);

  const startDeviceHeartbeat = (uid: string, role: string) => {
    if (deviceHeartbeat.current.uid === uid) return;
    deviceHeartbeat.current.stop?.();
    const generation = deviceHeartbeat.current.generation + 1;
    deviceHeartbeat.current = { uid, generation };
    void registerActiveDevice(uid, role).then(stop => {
      if (deviceHeartbeat.current.uid === uid && deviceHeartbeat.current.generation === generation) deviceHeartbeat.current.stop = stop;
      else stop();
    });
  };
  const stopDeviceHeartbeat = () => {
    deviceHeartbeat.current.stop?.();
    deviceHeartbeat.current = { uid: '', generation: deviceHeartbeat.current.generation + 1 };
  };
  const finishSplashAnimation = () => {
    if (splashAnimationComplete.current) return;
    splashAnimationComplete.current = true;
    if (startupReady.current && iconFontsReady.current) setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const markIconFontsReady = () => {
      if (!active) return;
      iconFontsReady.current = true;
      if (startupReady.current && splashAnimationComplete.current) setLoading(false);
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Expo injecte aussi une déclaration basée sur /assets/node_modules, chemin
      // que Hosting ne sert pas. Le pipeline ajoute la déclaration publique valide.
      document.getElementById('expo-generated-fonts')?.remove();
      void Promise.all([
        document.fonts.load('29px "ionicons"'),
        document.fonts.load('30px "FontAwesome"'),
        document.fonts.load('20px "FontAwesome5Free-Solid"'),
        document.fonts.load('20px "material-community"'),
      ]).catch((error) => {
        console.warn('Préchargement des fontes Web indisponible:', error);
      }).finally(markIconFontsReady);
    } else {
      void Font.loadAsync({
        ...Ionicons.font,
        ...FontAwesome.font,
        ...FontAwesome5.font,
        ...MaterialCommunityIcons.font,
      }).catch((error) => {
        // L’application reste utilisable même si une plateforme refuse une fonte;
        // les composants d’icônes retenteront leur rendu après le montage.
        console.warn('Préchargement des fontes d’icônes indisponible:', error);
      }).finally(markIconFontsReady);
    }
    return () => {
      active = false;
    };
  }, []);

  // Le choix d’un style relance visuellement le démarrage avec le thème mémorisé.
  useEffect(() => {
    // Pendant l'initialisation, le thème sauvegardé peut remplacer le thème
    // par défaut. Ce chargement n'est pas un changement de style demandé par
    // l'utilisateur et ne doit donc jamais afficher le splash de thème.
    if (loading || previousTheme.current === theme || !isUnlocked) {
      previousTheme.current = theme;
      return undefined;
    }
    previousTheme.current = theme;
    setThemeSplashVisible(true);
    return undefined;
  }, [theme, isUnlocked, loading]);

  useEffect(() => {
    if (!isUnlocked) return undefined;
    const tick = () => {
      const store = useBetStore.getState();
      store.betHistory.filter((coupon) => coupon.events?.some((event) => isMortalKombatEvent(event) || isPokerEvent(event))).forEach((coupon) => {
        (coupon.events ?? []).filter(isMortalKombatEvent).forEach((event) => {
          if (!event.isLive && event.status !== 'Gagné' && event.status !== 'Perdu' && event.status !== 'Payé' && isMortalKombatStartDue(event)) {
            store.toggleEventLive(coupon.id, event.id, true, '00:00');
          }
        });
        (coupon.events ?? []).filter(isPokerEvent).forEach((event) => {
          if (!event.isLive && event.status !== 'Gagné' && event.status !== 'Perdu' && event.status !== 'Payé' && isPokerStartDue(event)) {
            store.toggleEventLive(coupon.id, event.id, true, '00:00');
          }
        });
        store.autoSettleMortalKombatCoupon(coupon.id);
        store.autoSettlePokerCoupon(coupon.id);
      });
      // Le règlement transversal couvre aussi les coupons mixtes et les matchs
      // classiques déjà validés, sans recréditer un coupon déjà payé.
      store.betHistory.forEach((coupon) => store.autoSettleCoupon(coupon.id));
      // Les matchs FIFA simulés doivent être évalués au même rythme que les
      // événements Combat et Poker afin de créditer automatiquement les gains
      // dès que la rencontre est terminée.
      store.betHistory
        .filter((coupon) => coupon.events?.some((event) => event.sport === 'FIFA' || event.tournament.trim().toUpperCase().startsWith('FIFA')))
        .forEach((coupon) => store.autoSettleFifaCoupon(coupon.id));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isUnlocked, betHistory.length]);

  useEffect(() => {
    // Ne charge aucune page de jeu pendant le splash ou la connexion.
    if (!isUnlocked) return;
    prefetchAppRoutes(router);
  }, [isUnlocked]);

  const handleLoginSuccess = (username: string, role: string, uid: string) => {
    const info = generateAndSaveSessionId();
    useBetStore.getState().setSessionId(info.sessionId);
    useBetStore.getState().updateBalance(info.balance);
    useBetStore.getState().setSessionUser(username, role);
    useBetStore.getState().loadFromDb();
    // Initialise la synchronisation Firebase des droits Fast Games.
    // La synchronisation des jeux rapides ne doit pas bloquer l’ouverture.
    setTimeout(() => { void initFastGamesFirebase(); }, 0);
    setAccessError('');
    startDeviceHeartbeat(uid, role);
    setIsUnlocked(true);
  };

  useEffect(() => {
    let unsubscribe = () => {};
    let retryableAuthSplashTimer: ReturnType<typeof setTimeout> | undefined;
    let startupResolved = false;
    const finishStartup = () => {
      if (startupResolved) return;
      startupResolved = true;
      if (retryableAuthSplashTimer) clearTimeout(retryableAuthSplashTimer);
      retryableAuthSplashTimer = undefined;
      startupReady.current = true;
      if (splashAnimationComplete.current && iconFontsReady.current) setLoading(false);
    };
    try {
      initDatabase();
      const info = generateAndSaveSessionId();
      useBetStore.getState().setSessionId(info.sessionId);
      useBetStore.getState().updateBalance(info.balance);
      useBetStore.getState().loadFromDb();
      setSplashThemeReady(true);

      if (localAofPreview) {
        setIsUnlocked(true);
        setAccessError('');
        finishStartup();
      } else {
        // Vérifie à l'ouverture de l'application si l'utilisateur existe, s'il est actif et récupère son rôle
        unsubscribe = listenToAuthSession((profile, errorMsg, sessionCheck) => {
        if (profile) {
          useBetStore.getState().setSessionUser(profile.username, profile.role);
          startDeviceHeartbeat(profile.uid, profile.role);
          // Initialise la synchronisation Firebase des droits Fast Games.
          // Les droits secondaires se synchronisent après l’affichage du shell.
          setTimeout(() => { void initFastGamesFirebase(); }, 0);
          setAccessError('');
          setIsUnlocked(true);
          finishStartup();
          return;
        }
        if (sessionCheck?.authenticated && sessionCheck.retryable) {
          // L’identité Firebase est déjà restaurée sur ce téléphone. On garde
          // l’écran de démarrage pendant la nouvelle vérification serveur, sans
          // afficher le formulaire de mot de passe ni ouvrir l’application trop tôt.
          setAccessError(errorMsg || 'La session ne peut pas être vérifiée. Vérifiez votre connexion; vous pourrez réessayer ou vous reconnecter.');
          if (!retryableAuthSplashTimer) {
            retryableAuthSplashTimer = setTimeout(() => {
              retryableAuthSplashTimer = undefined;
              startupReady.current = true;
              if (splashAnimationComplete.current && iconFontsReady.current) setLoading(false);
            }, RETRYABLE_AUTH_SPLASH_TIMEOUT_MS);
          }
          return;
        }
        useBetStore.getState().setSessionUser(null, null);
        stopDeviceHeartbeat();
        resetFastGamesFirebase();
        setIsUnlocked(false);
        // Aucun message automatique ne doit être injecté dans le formulaire au démarrage.
        // Une erreur explicite reste disponible uniquement après une tentative de connexion.
        setAccessError('');
        finishStartup();
        });
      }
    } catch (e) {
      console.error(e);
      setSplashThemeReady(true);
      finishStartup();
    }
    return () => {
      unsubscribe();
      stopDeviceHeartbeat();
      if (retryableAuthSplashTimer) clearTimeout(retryableAuthSplashTimer);
    };
  }, []);

  if (visualQaRoute && Platform.OS === 'web' && typeof window !== 'undefined') {
    const params = new URL(window.location.href).searchParams;
    const requestedTheme = params.get('style') || 'blue';
    const previewTheme = ['blue', 'royal_blue', 'green', 'gold', 'light_green', 'red_mega'].includes(requestedTheme) ? requestedTheme : 'blue';
    return <ThemeSplash theme={previewTheme} animate={params.get('still') !== '1'} />;
  }

  if (loading && !visualQaRoute) {
    if (!splashThemeReady) return <View style={layoutStyles.neutralStartupSplash} />;
    return <SplashScreen onComplete={finishSplashAnimation} />;
  }

  if (!isUnlocked && !localAofPreview) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} accessError={accessError} />;
  }

  return (
    <SafeAreaProvider>
      <PwaHead />
      <View style={layoutStyles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 250,
            fullScreenGestureEnabled: true,
            animationMatchesGesture: true,
            gestureEnabled: true,
            gestureDirection: "horizontal",
            contentStyle: { backgroundColor: rootPalette.appBg },
          }}
        >
        {/* Index (Historique) – écran racine, pas d'animation */}
        <Stack.Screen name="index" options={{ animation: "none" }} />

        {/* Coupon – slide horizontal */}
        <Stack.Screen
          name="bet-details"
          options={{ animation: "slide_from_right", animationDuration: 220 }}
        />

        {/* Détails historique */}
        <Stack.Screen
          name="history-details"
          options={{ animation: "slide_from_right", animationDuration: 220 }}
        />

        {/* Modifier le montant de vente */}
        <Stack.Screen
          name="edit-sell-amount"
          options={{ animation: "slide_from_right", animationDuration: 220 }}
        />

        {/* Détails du match – modal depuis le bas */}
        <Stack.Screen
          name="match-details"
          options={{
            animation: "slide_from_bottom",
            animationDuration: 280,
            fullScreenGestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />

        {/* Menu – instantané (tab) */}
        <Stack.Screen name="menu" options={{ animation: "none" }} />

        {/* Admin – modal depuis le bas */}
        <Stack.Screen
          name="admin"
          options={{
            animation: "slide_from_bottom",
            animationDuration: 280,
            fullScreenGestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />

        {/* Personnalisation du thème */}
        <Stack.Screen
          name="admin-theme"
          options={{
            animation: "slide_from_right",
            animationDuration: 220,
          }}
        />
        </Stack>
        {themeSplashVisible && (
          <View style={layoutStyles.themeSplashOverlay} accessibilityLabel={`Redémarrage du thème ${theme}`}>
            <SplashScreen onComplete={() => setThemeSplashVisible(false)} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const layoutStyles = StyleSheet.create({
  root: { flex: 1 },
  neutralStartupSplash: { flex: 1, backgroundColor: '#101820' },
  themeSplashOverlay: { ...StyleSheet.absoluteFill, zIndex: 2000, elevation: 2000 },
});

const authStyles = StyleSheet.create({
  referenceSplash: {
    flex: 1,
    backgroundColor: '#263B59',
  },
  dynamicSplashLogo: { position: 'absolute', left: '12%', top: '35%', width: '76%', height: '13%' },
  megaPariSplashLogo: { left: '3%', width: '94%', height: '24%' },
  splashLoaderRow: {
    position: 'absolute',
    bottom: '6.5%',
    left: '28%',
    right: '28%',
    height: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splashLoaderSlot: { width: 16, height: 15 },
  splashLoaderIcon: { position: 'absolute', left: 0, top: 0, width: 16, height: 15 },
  splashPartnerRow: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: '14%',
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  splashPartnerLogo: { width: 54, height: 59 },
  container: {
    flexGrow: 1,
    backgroundColor: '#0F263C', // 1xBet dark blue background
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E364F',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2F4F72',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: '#162C44',
    borderRadius: 45,
    padding: 12,
    borderWidth: 1,
    borderColor: '#253D57',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#083B68',
    marginBottom: 38,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  subtitle: {
    fontSize: 12.5,
    color: '#B5C4D7',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 34,
  },
  screen: {
    flex: 1,
    backgroundColor: '#EAF0F8',
  },
  patternArea: {
    height: '28.5%',
    minHeight: 230,
    width: '100%',
  },
  authPanel: {
    flex: 1,
    marginTop: -1,
    backgroundColor: '#EAF0F8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  authPanelContent: {
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 36,
    alignItems: 'stretch',
  },
  inputLineRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#A8B9C8',
  },
  inputActionBadge: {
    width: 70,
    height: 62,
    borderRadius: 14,
    marginLeft: 12,
    backgroundColor: '#4C92DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeButton: {
    padding: 12,
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  forgotText: {
    color: '#4C92DE',
    fontSize: 18,
    fontWeight: '700',
  },
  supportIcon: {
    alignSelf: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#4C92DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 20,
  },
  registrationText: {
    textAlign: 'center',
    color: '#5E7F99',
    fontSize: 16,
  },
  registrationLink: {
    color: '#4C92DE',
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(43, 78, 112, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 18,
    fontWeight: '400',
    color: '#5E7F99',
    marginBottom: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F263C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#253D57',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#123F68',
    fontSize: 22,
    fontWeight: '500',
    height: 54,
    paddingVertical: 0,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#162C44',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#253D57',
    height: 40,
  },
  roleBtnActive: {
    backgroundColor: '#3882C7',
    borderColor: '#3882C7',
  },
  roleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#8AAAC8',
  },
  roleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#4C92DE',
    borderRadius: 12,
    minHeight: 68,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '500',
  },
  switchBtn: {
    marginTop: 18,
    padding: 6,
  },
  switchText: {
    color: '#8AAAC8',
    fontSize: 13,
    fontWeight: '600',
  },
});
