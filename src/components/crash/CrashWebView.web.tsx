import { createElement, forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { CrashWebViewHandle, CrashWebViewMessageEvent, CrashWebViewProps } from './CrashWebView.types';

type EmbeddedFrame = HTMLIFrameElement;

const CrashWebView = forwardRef<CrashWebViewHandle, CrashWebViewProps>(function CrashWebView(
  { html, onMessage, onLoad },
  ref,
) {
  const frameRef = useRef<EmbeddedFrame | null>(null);

  useImperativeHandle(ref, () => ({
    postMessage(message: string) {
      try {
        const payload = JSON.parse(message);
        frameRef.current?.contentWindow?.postMessage({ __onexNativePayload: payload }, '*');
      } catch {
        // Un message mal formé ne doit pas interrompre l’aperçu.
      }
    },
  }), []);

  useLayoutEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const envelope = event.data;
      if (!envelope || typeof envelope !== 'object' || !envelope.__onexGameMessage) return;
      const messageEvent: CrashWebViewMessageEvent = {
        nativeEvent: { data: JSON.stringify(envelope.__onexGameMessage) },
      };
      onMessage(messageEvent);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onMessage]);

  return createElement('iframe' as never, {
    ref: frameRef,
    title: 'Interface Crash',
    srcDoc: html,
    sandbox: 'allow-scripts allow-forms',
    onLoad,
    frameBorder: 0,
    style: {
      display: 'block',
      width: '100%',
      height: '100%',
      border: 0,
      background: '#080f23',
    },
  } as never);
});

export default CrashWebView;
