/**
 * The pending-sync line — one hairline-ruled strip that sits directly above the
 * tab bar and only exists when there is something to say.
 *
 * Field-notebook treatment: no icon, no colour block, no emoji. An uppercase
 * letterspaced eyebrow, the count in mono so it reads as a ledger figure, and
 * the one action worth offering (send it now). Rejected entries get an accent
 * line the user has to dismiss, because a discarded log the user never hears
 * about is data loss they will discover much later, from the gap.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Badge, Eyebrow } from '../components/ui'
import { monoFont } from '../lib/fonts'
import { usePalette, space } from '../theme'
import { dismissOutboxNotice, drainOutbox } from './outbox'
import { useOutbox } from './useOutbox'

export function OutboxIndicator() {
  const p = usePalette()
  const { pending, draining, notice } = useOutbox()

  if (pending === 0 && !notice) return null

  return (
    <View
      style={{
        backgroundColor: p.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: p.border,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        gap: space.xs,
      }}
    >
      {pending > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {/* Grouped as one accessible element so a screen reader reads the
              sentence, not "waiting to sync" then a bare number. The action
              stays outside it so it remains separately focusable. */}
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${pending} ${
              pending === 1 ? 'entry' : 'entries'
            } saved on this device, waiting to sync`}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          >
            <Eyebrow text="Waiting to sync" />
            <Text
              style={{ color: p.textMain, fontSize: 12, fontWeight: '600', fontFamily: monoFont }}
            >
              {pending}
            </Text>
          </View>
          {draining ? (
            <Badge text="Sending" color={p.secondary} />
          ) : (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void drainOutbox()}>
              <Eyebrow text="Sync now" color={p.primary} />
            </Pressable>
          )}
        </View>
      ) : null}

      {notice ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ color: p.accent, fontSize: 12, flex: 1 }}>{notice}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={dismissOutboxNotice}>
            <Eyebrow text="Dismiss" color={p.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
