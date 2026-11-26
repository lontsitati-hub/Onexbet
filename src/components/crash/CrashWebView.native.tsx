import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import type { CrashWebViewHandle, CrashWebViewMessageEvent, CrashWebViewProps } from './CrashWebView.types';

const CrashWebView = forwardRef<CrashWebViewHandle, CrashWebViewProps>(function CrashWebView(
  { html, onMessage, onLoad },
  ref,
) {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    postMessage(message: string) {
      let payload: unknown;
      try {
        payload = JSON.parse(message);
      } catch {
        return;
      }
      const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
      webViewRef.current?.injectJavaScript(`window.__onexWalletReceive?.(${safePayload}); true;`);
    },
  }), []);

  const handleMessage = (event: WebViewMessageEvent) => {
    onMessage(event as CrashWebViewMessageEvent);
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ html }}
      originWhitelist={['about:blank']}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
      onMessage={handleMessage}
      onLoad={onLoad}
      javaScriptEnabled
      domStorageEnabled={false}
      mixedContentMode="never"
      setSupportMultipleWindows={false}
      allowsBackForwardNavigationGestures={false}
      scrollEnabled
      nestedScrollEnabled
      bounces={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      setDisplayZoomControls={false}
      style={styles.webView}
      containerStyle={styles.webView}
      accessibilityLabel="Jeu Crash"
    />
  );
});

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: '#080f23' },
});

export default CrashWebView;
