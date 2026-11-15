import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Image, ImageBackground, Modal, Platform, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View, ActivityIndicator,
} from 'react-native';
import { SPRITES, RATIO } from './sprites';

// ───────────── צבעים (לקוחים מהשפה הצבעונית של קולאז' המותג) ─────────────
export const C = {
  bg: '#F6F1FF', card: '#FFFFFF', ink: '#1E1B3A', muted: '#6B6890', border: '#E6DEFA',
  purple: '#6D28D9', deep: '#4C1D95', violet: '#8B5CF6', lilac: '#DDD3FD',
  blue: '#2563EB', cyan: '#06B6D4', pink: '#EC4899', magenta: '#C026D3',
  gold: '#F59E0B', yellow: '#FDE047', green: '#10B981', greenDark: '#047857', red: '#F43F5E', redDark: '#BE123C',
  // תאימות לשמות הישנים
  primary: '#6D28D9', primaryDark: '#4C1D95', text: '#1E1B3A', accent: '#FBBF24',
};

export const TOP = Platform.OS === 'ios' ? 48 : Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

export const shekel = (n) => '₪' + Number(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ───────────── טקסט ─────────────
export function T({ style, children, ...p }) {
  return <Text {...p} style={[s.text, style]}>{children}</Text>;
}

// ───────────── דמות (Sprite) עם כניסה ותנועה עדינה ─────────────
export function Sprite({ name, width = 120, height, float = false, enter = true, style, cover = false, round = 0 }) {
  const src = SPRITES[name] || SPRITES.think_who;
  const h = height || width / (RATIO[name] || 1);
  const appear = useRef(new Animated.Value(enter ? 0 : 1)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (enter) Animated.spring(appear, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    if (float) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: -5, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, []);
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  return (
    <Animated.View style={[{ width, height: h, opacity: appear, transform: [{ scale }, { translateY: bob }] }, style]}>
      <Image source={src} style={{ width: '100%', height: '100%', borderRadius: round }} resizeMode={cover ? 'cover' : 'contain'} />
    </Animated.View>
  );
}

// ───────────── כפתור עם עומק ולחיצה ─────────────
const KINDS = {
  primary: { bg: '#7C3AED', edge: '#5B21B6', fg: '#fff' },
  ok: { bg: '#10B981', edge: '#047857', fg: '#fff' },
  danger: { bg: '#F43F5E', edge: '#BE123C', fg: '#fff' },
  gold: { bg: '#FBBF24', edge: '#D97706', fg: '#3B2A00' },
  ghost: { bg: '#EEE8FF', edge: '#D3C6FA', fg: '#4C1D95' },
};
export function Btn({ title, onPress, kind = 'primary', small, disabled, style }) {
  const k = KINDS[kind] || KINDS.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall,
        { backgroundColor: k.bg, borderBottomColor: k.edge, borderBottomWidth: pressed ? 1 : 4, marginTop: pressed ? 3 : 0, opacity: disabled ? 0.5 : 1 },
        style,
      ]}>
      <Text style={[s.btnText, { color: k.fg }, small && { fontSize: 14 }]}>{title}</Text>
    </Pressable>
  );
}

export function Input({ style, ...p }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput placeholderTextColor="#A59FC4" {...p}
      onFocus={(e) => { setFocus(true); p.onFocus && p.onFocus(e); }}
      onBlur={(e) => { setFocus(false); p.onBlur && p.onBlur(e); }}
      style={[s.input, focus && { borderColor: C.violet, backgroundColor: '#FBF9FF' }, style]} />
  );
}

// ───────────── כרטיס עם פס צבע ─────────────
export function Card({ children, style, accent }) {
  return (
    <View style={[s.card, accent && { borderRightWidth: 6, borderRightColor: accent }, style]}>{children}</View>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
            style={[s.chip, on && { backgroundColor: C.purple, borderColor: C.deep }]}>
            <Text style={{ color: on ? '#fff' : C.ink, fontWeight: '700' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ───────────── כותרת עליונה בגרדיאנט ─────────────
export function Header({ title, subtitle, sprite }) {
  return (
    <ImageBackground source={require('../assets/ui/header.webp')} resizeMode="cover" style={s.header} imageStyle={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{title}</T>
          {!!subtitle && <T style={{ color: '#EADFFF', fontSize: 14, marginTop: 2 }}>{subtitle}</T>}
        </View>
        {!!sprite && <Sprite name={sprite} width={64} height={64} cover round={20} float style={{ marginLeft: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 22 }} />}
      </View>
    </ImageBackground>
  );
}

// ───────────── חלון תחתון עם דמות ─────────────
export function Sheet({ visible, onClose, title, sprite, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 }}>
            {!!sprite && <Sprite name={sprite} width={60} height={60} cover round={18} style={{ marginLeft: 12 }} />}
            <T style={s.sheetTitle}>{title}</T>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ───────────── מצבים: טעינה / ריק / שגיאה ─────────────
export function Loading({ text = 'רגע, מכינים לך קפה...', sprite = 'coffee' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Sprite name={sprite} width={200} float />
      <ActivityIndicator size="small" color={C.purple} style={{ marginTop: 14 }} />
      <T style={{ color: C.muted, textAlign: 'center', marginTop: 8 }}>{text}</T>
    </View>
  );
}

export function Empty({ sprite = 'relax', title, text, children }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 28, paddingHorizontal: 18 }}>
      <Sprite name={sprite} width={220} float />
      {!!title && <T style={{ fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 14 }}>{title}</T>}
      {!!text && <T style={{ color: C.muted, textAlign: 'center', marginTop: 6 }}>{text}</T>}
      {children}
    </View>
  );
}

export function ErrorBox({ text, onRetry }) {
  return (
    <Card accent={C.red} style={{ marginHorizontal: 14 }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
        <Sprite name="facepalm" width={72} height={64} cover round={16} style={{ marginLeft: 12 }} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '800' }}>אופס, משהו השתבש</T>
          <T style={{ color: C.muted, fontSize: 13 }}>{text}</T>
        </View>
      </View>
      {onRetry && <Btn small kind="ghost" title="ניסיון חוזר" onPress={onRetry} style={{ marginTop: 10, alignSelf: 'flex-end' }} />}
    </Card>
  );
}

// ───────────── מעבר נעים בין מסכים ─────────────
export function FadeIn({ children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ───────────── חגיגה (קונפטי + דמות) ─────────────
const PIECES = ['🪙', '✨', '💜', '🎉', '💸', '⭐'];
export function Celebrate({ data, onDone }) {
  const parts = useMemo(() => (data ? Array.from({ length: 18 }, (_, i) => ({
    emoji: PIECES[i % PIECES.length], x: Math.random() * (SCREEN_W - 30), delay: Math.random() * 500,
    dur: 1500 + Math.random() * 1000, v: new Animated.Value(0), size: 20 + Math.random() * 14,
  })) : []), [data]);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!data) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    parts.forEach((p) => Animated.timing(p.v, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start());
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [data]);
  if (!data) return null;
  return (
    <Pressable onPress={onDone} style={s.celebrate}>
      {parts.map((p, i) => (
        <Animated.Text key={i} style={{
          position: 'absolute', top: -40, left: p.x, fontSize: p.size,
          transform: [{ translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_H + 60] }) }, { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}>{p.emoji}</Animated.Text>
      ))}
      <Animated.View style={[s.celebrateCard, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Sprite name={data.sprite || 'closed'} width={210} enter={false} />
        <T style={{ fontSize: 24, fontWeight: '900', color: C.deep, textAlign: 'center', marginTop: 10 }}>{data.title}</T>
        {!!data.subtitle && <T style={{ color: C.muted, textAlign: 'center', marginTop: 4 }}>{data.subtitle}</T>}
      </Animated.View>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  text: { color: C.ink, fontSize: 16, textAlign: 'right', writingDirection: 'rtl' },
  btn: { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12 },
  btnText: { fontSize: 16, fontWeight: '800' },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, textAlign: 'right', writingDirection: 'rtl', color: C.ink, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#4C1D95', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 22, borderWidth: 2, borderColor: C.border, backgroundColor: '#fff' },
  header: { height: TOP + 98, paddingTop: TOP + 10, paddingHorizontal: 18, marginBottom: 4, justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(30,10,70,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, maxHeight: '90%' },
  sheetTitle: { fontSize: 21, fontWeight: '900', color: C.deep, flex: 1 },
  celebrate: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,10,70,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  celebrateCard: { backgroundColor: '#fff', borderRadius: 30, padding: 20, alignItems: 'center', width: 290 },
});
