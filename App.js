import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, BackHandler, I18nManager, Linking, Share, StatusBar, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { configured, supabase } from './src/supabase';
import { createBridge } from './src/bridge';
import html from './src/webui.generated';

// הממשק כולו (HTML/CSS/JS) רץ בתוך WebView. כל הגישה ל-Supabase עוברת בגשר src/bridge.js.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const BASE = 'https://dalipay.app.local/';

export default function App() {
  const ref = useRef(null);
  const send = useCallback((obj) => {
    if (ref.current) ref.current.injectJavaScript(`window.__fromNative && window.__fromNative(${JSON.stringify(obj)}); true;`);
  }, []);

  const bridge = useMemo(() => createBridge(supabase, {
    emit: send,
    share: (text) => Share.share({ message: text }),
    exit: () => BackHandler.exitApp(),
    open: (url) => Linking.openURL(url),
  }), [send]);

  const onMessage = useCallback(async (e) => {
    let msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch (_) { return; }
    if (!msg || typeof msg.op !== 'string') return;
    if (!configured) return send({ id: msg.id, ok: false, error: 'האפליקציה לא מחוברת לענן (חסר מפתח Supabase)' });
    send(await bridge.handle(msg));
  }, [bridge, send]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { send({ event: 'back' }); return true; });
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') send({ event: 'resume' }); });
    return () => { back.remove(); app.remove(); };
  }, [send]);

  return (
    <View style={{ flex: 1, backgroundColor: '#38b6ff' }}>
      <StatusBar barStyle="light-content" backgroundColor="#38b6ff" translucent={false} />
      <WebView
        ref={ref}
        source={{ html, baseUrl: BASE }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        textZoom={100}
        bounces={false}
        showsVerticalScrollIndicator={false}
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith(BASE)}
        style={{ flex: 1, backgroundColor: '#38b6ff' }}
      />
    </View>
  );
}
