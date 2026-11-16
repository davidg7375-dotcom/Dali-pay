import React, { useEffect } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Btn, Card, Empty, Loading, Sprite, T, C } from './ui';
import { fmtDateTime } from './money';

export default function MessagesScreen({ ctx }) {
  const { me, messages, messagesState, nameOf, openMessage, openCompose, intent, clearIntent } = ctx;
  useEffect(() => { if (intent === 'compose') { openCompose(); clearIntent(); } }, [intent]);
  if (messagesState.loading) return <Loading text="טוענים הודעות..." sprite="hoodies" />;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={messages} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={<Empty sprite="sleeping" title="אין הודעות עדיין" text="שלח לשותף שלך תזכורת, מדבקה או סתם הודעה." />}
        renderItem={({ item: m }) => {
          const mine = m.sender_id === me;
          const unread = !mine && !m.read_at;
          return (
            <Pressable onPress={() => openMessage(m.id)}>
              <Card accent={unread ? C.magenta : mine ? C.cyan : C.lilac}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                  <Sprite name={m.sticker || 'reminder_sent'} width={62} height={62} cover round={16} enter={false} style={{ marginLeft: 12 }} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: unread ? '900' : '700', color: unread ? C.deep : C.ink }}>{mine ? `נשלח ל${nameOf(m.recipient_id)}` : `מאת ${nameOf(m.sender_id)}`}{unread ? ' • חדש' : ''}</T>
                    {!!m.body && <T numberOfLines={2} style={{ fontSize: 15 }}>{m.body}</T>}
                    <T style={{ color: C.muted, fontSize: 12 }}>{fmtDateTime(m.created_at)}{mine ? (m.read_at ? ' • נקרא' : m.push_status === 'sent' ? ' • התראה נשלחה' : '') : ''}</T>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <Btn title="שלח הודעה" onPress={() => openCompose()} style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }} />
    </View>
  );
}
