import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBetStore } from '@/store/useBetStore';
import { navigateTo1xGames } from '@/utils/gameNavigation';
import { auth, db } from '@/services/firebase';
import CrashWebView from './CrashWebView';
import type { CrashWebViewHandle, CrashWebViewMessageEvent } from './CrashWebView.types';
import { CRASH_GAME_HTML } from './gameHtml';
import { CrashWalletProcessor, type CrashWalletOperation, type CrashWalletPayload } from './crashWallet';
import { loadLastCrashBotCommandId, parseCrashBotCommand, persistCrashBotCommandId, type CrashBotTarget } from './crashBotCommand';

type WalletRequestMessage = {
  type: 'wallet_request';
  id: string;
  operation: CrashWalletOperation;
  payload?: CrashWalletPayload;
};
type WalletMessage = WalletRequestMessage | { type: 'exit' };

const walletProcessor = new CrashWalletProcessor({
  getBalance: () => useBetStore.getState().balance,
  updateBalance: (amount) => useBetStore.getState().updateBalance(amount),
});
const CRASH_LOADING_START_FRAME = require('@/assets/game/xgame-loading/frame-00.png');
const CRASH_LOADING_COMPLETE_FRAME = require('@/assets/game/xgame-loading/frame-10.png');
const CRASH_LOADING_COMPLETE_HOLD_MS = 110;

function showWalletSaveError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Impossible d’enregistrer le solde.';
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert('Portefeuille', message);
}

export default function CrashGameScreen() {
  const insets = useSafeAreaInsets();
  const balance = useBetStore((state) => state.balance);
  const [webLoaded, setWebLoaded] = useState(false);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(true);
  const [webLoadComplete, setWebLoadComplete] = useState(false);
  const webViewRef = useRef<CrashWebViewHandle>(null);
  const leavingToLobby = useRef(false);
  const webLoadedRef = useRef(false);
  const loadingHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBotCommandId = useRef<string | null>(null);
  const pendingBotCommand = useRef<CrashBotTarget | null>(null);

  const sendToGame = useCallback((message: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
  }, []);

  const handleWebLoadSuccess = useCallback(() => {
    if (!webLoadedRef.current) {
      webLoadedRef.current = true;
      setWebLoaded(true);
      setWebLoadComplete(true);
      loadingHideTimer.current = setTimeout(() => setLoadingOverlayVisible(false), CRASH_LOADING_COMPLETE_HOLD_MS);
    }
    const pending = pendingBotCommand.current;
    if (pending) {
      pendingBotCommand.current = null;
      sendToGame({ type: 'bot_crash_target', ...pending });
    }
  }, [sendToGame]);

  const leaveToPopular = useCallback(async () => {
    if (leavingToLobby.current) return;
    leavingToLobby.current = true;
    try {
      await walletProcessor.closeOpenBets();
      useBetStore.getState().setActiveTab('populaire');
      navigateTo1xGames();
    } catch (error) {
      leavingToLobby.current = false;
      showWalletSaveError(error);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void leaveToPopular();
      return true;
    });
    return () => subscription.remove();
  }, [leaveToPopular]);

  useEffect(() => {
    let active = true;
    let authGeneration = 0;
    let stopChannel: (() => void) | undefined;
    let persistenceQueue = Promise.resolve();
    let persistenceFailed = false;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      const generation = ++authGeneration;
      stopChannel?.();
      stopChannel = undefined;
      lastBotCommandId.current = null;
      pendingBotCommand.current = null;
      if (!user?.uid) return;
      persistenceFailed = false;
      void loadLastCrashBotCommandId(AsyncStorage, user.uid).then((savedCommandId) => {
        if (!active || generation !== authGeneration || auth.currentUser?.uid !== user.uid) return;
        lastBotCommandId.current = savedCommandId;
        stopChannel = onSnapshot(doc(db, 'crash_channels', user.uid), (snapshot) => {
          const command = parseCrashBotCommand(snapshot.data(), Date.now(), lastBotCommandId.current);
          if (!command || persistenceFailed) return;
          const previousCommandId = lastBotCommandId.current;
          lastBotCommandId.current = command.commandId;
          persistenceQueue = persistenceQueue.then(async () => {
            if (persistenceFailed) return;
            await persistCrashBotCommandId(AsyncStorage, user.uid, command.commandId);
            if (!active || generation !== authGeneration || auth.currentUser?.uid !== user.uid) return;
            if (lastBotCommandId.current !== command.commandId) return;
            if (webLoadedRef.current) {
              sendToGame({ type: 'bot_crash_target', ...command });
            } else {
              pendingBotCommand.current = command;
            }
          }).catch((error: unknown) => {
            if (!active || generation !== authGeneration || auth.currentUser?.uid !== user.uid) return;
            persistenceFailed = true;
            if (lastBotCommandId.current === command.commandId) lastBotCommandId.current = previousCommandId;
            console.warn('Bot Crash: impossible de sécuriser la déduplication locale.', error);
          });
        }, () => undefined);
      }).catch((error: unknown) => {
        if (active && generation === authGeneration) {
          persistenceFailed = true;
          console.warn('Bot Crash désactivé : impossible de lire le dernier commandId local.', error);
        }
      });
    });
    return () => {
      active = false;
      authGeneration += 1;
      stopAuth();
      stopChannel?.();
    };
  }, [sendToGame]);

  useEffect(() => () => {
    if (loadingHideTimer.current) clearTimeout(loadingHideTimer.current);
    void walletProcessor.closeOpenBets().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!webLoaded) return;
    sendToGame({ type: 'wallet_update', snapshot: { amount: balance, currency: 'XAF' } });
  }, [balance, sendToGame, webLoaded]);

  const onMessage = useCallback((event: CrashWebViewMessageEvent) => {
    let message: WalletMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WalletMessage;
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'exit') {
      void leaveToPopular();
      return;
    }
    if (message.type !== 'wallet_request' || !message.id) return;

    void walletProcessor.process({ operation: message.operation, payload: message.payload }).then(
      (snapshot) => sendToGame({ type: 'wallet_response', id: message.id, ok: true, snapshot }),
      (error: unknown) => sendToGame({
        type: 'wallet_response',
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : 'Opération du portefeuille refusée.',
      }),
    );
  }, [leaveToPopular, sendToGame]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <CrashWebView
        ref={webViewRef}
        html={CRASH_GAME_HTML}
        onMessage={onMessage}
        onLoad={handleWebLoadSuccess}
      />
      {loadingOverlayVisible && (
        <View
          style={styles.loadingOverlay}
          accessibilityLabel="Chargement du jeu Crash"
        >
          <Image
            source={webLoadComplete ? CRASH_LOADING_COMPLETE_FRAME : CRASH_LOADING_START_FRAME}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
            accessibilityLabel={webLoadComplete ? 'Chargement terminé' : 'Jeu en préparation'}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080f23' },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 10,
    pointerEvents: 'none',
    backgroundColor: '#1D4367',
  },
});
