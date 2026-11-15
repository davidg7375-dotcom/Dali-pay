import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';

export const C = {
  bg: '#F4F0FF', card: '#FFFFFF', primary: '#6D3FE0', primaryDark: '#4B24B5', accent: '#FBBF24',
  text: '#1E1B33', muted: '#6B6785', green: '#16A34A', red: '#DC2626', border: '#E3DCF7',
};

export const shekel = (n) => '₪' + Number(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function T({ style, children, ...p }) {
  return <Text {...p} style={[s.text, style]}>{children}</Text>;
}

export function Btn({ title, onPress, kind = 'primary', small, disabled, style }) {
  const bg = kind === 'primary' ? C.primary : kind === 'danger' ? C.red : kind === 'ok' ? C.green : '#EDE7FF';
  const fg = kind === 'ghost' ? C.primaryDark : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}>
      <Text style={[s.btnText, { color: fg }, small && { fontSize: 14 }]}>{title}</Text>
    </Pressable>
  );
}

export function Input({ style, ...p }) {
  return <TextInput placeholderTextColor="#A59FC4" {...p} style={[s.input, style]} />;
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 }}>
      {options.map((o) => (
        <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
          style={[s.chip, value === o.value && { backgroundColor: C.primary, borderColor: C.primary }]}>
          <Text style={{ color: value === o.value ? '#fff' : C.text, fontWeight: '600' }}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <T style={s.sheetTitle}>{title}</T>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.primary} /></View>;
}

export function Empty({ text }) {
  return <T style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>{text}</T>;
}

export const s = StyleSheet.create({
  text: { color: C.text, fontSize: 16, textAlign: 'right', writingDirection: 'rtl' },
  btn: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontSize: 16, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, textAlign: 'right', writingDirection: 'rtl', color: C.text, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
  overlay: { flex: 1, backgroundColor: 'rgba(20,10,50,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '88%' },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
});
