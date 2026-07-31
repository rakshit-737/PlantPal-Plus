/**
 * UI primitives — the React Native mirror of apps/web/src/components/ui.tsx.
 * Small on purpose: Card, Button, Input, Badge, Spinner, EmptyState cover
 * every screen without pulling in a component library.
 *
 * Field-notebook rules: sharp corners (radius 2-4 only), hairline borders
 * instead of shadows, uppercase letterspaced eyebrows for labels, and every
 * metric in the system mono so numbers line up like ledger entries.
 */

import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import { monoFont, usePalette, space } from '../theme'

/** Shared type treatments — import these instead of re-declaring per screen. */
export const type = StyleSheet.create({
  /** Uppercase letterspaced eyebrow — section labels, tab labels, stamps. */
  eyebrow: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  /** Ledger metric — numbers in mono so columns line up. */
  metric: {
    fontFamily: monoFont,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  /** Small mono detail — units, latin names, macro read-outs. */
  mono: {
    fontFamily: monoFont,
    fontSize: 12,
  },
})

/** An uppercase letterspaced section label, muted by default. */
export function Eyebrow({
  text,
  color,
  style,
}: {
  text: string
  color?: string
  style?: StyleProp<TextStyle>
}) {
  const p = usePalette()
  return <Text style={[type.eyebrow, { color: color ?? p.textMuted }, style]}>{text}</Text>
}

/** A ledger value in mono. Pair with an Eyebrow above it for a stat tile. */
export function MetricText({
  text,
  color,
  style,
}: {
  text: string
  color?: string
  style?: StyleProp<TextStyle>
}) {
  const p = usePalette()
  return <Text style={[type.metric, { color: color ?? p.textMain }, style]}>{text}</Text>
}

export function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderColor: p.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 4,
          padding: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  disabled?: boolean
}) {
  const p = usePalette()
  // Mirrors the web: danger is an accent-outline stamp, not a solid red fill.
  const background =
    variant === 'primary' ? p.primary : variant === 'secondary' ? p.surface : 'transparent'
  const color =
    variant === 'primary'
      ? p.onPrimary
      : variant === 'danger'
        ? p.accent
        : variant === 'ghost'
          ? p.textMuted
          : p.textMain
  const borderColor =
    variant === 'secondary' ? p.border : variant === 'danger' ? p.accent : 'transparent'
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: background,
        borderColor,
        borderWidth: variant === 'secondary' || variant === 'danger' ? StyleSheet.hairlineWidth : 0,
        borderRadius: 3,
        paddingVertical: 12,
        paddingHorizontal: space.md,
        alignItems: 'center',
        opacity: disabled || loading ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={{ color, fontWeight: '600', fontSize: 14 }}>{title}</Text>
      )}
    </Pressable>
  )
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}) {
  const p = usePalette()
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Eyebrow text={label} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        {...(keyboardType ? { keyboardType } : {})}
        style={{
          backgroundColor: p.surface,
          borderColor: p.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 3,
          paddingVertical: 10,
          paddingHorizontal: space.md,
          color: p.textMain,
          fontSize: 15,
        }}
      />
    </View>
  )
}

/** A small tag for statuses, tiers and counts — squared, ledger-stamp style. */
export function Badge({ text, color }: { text: string; color?: string }) {
  const p = usePalette()
  const tone = color ?? p.primary
  return (
    <View
      style={{
        backgroundColor: `${tone}1a`,
        borderColor: `${tone}66`,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 2,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: tone,
          fontSize: 10,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {text}
      </Text>
    </View>
  )
}

export function Spinner() {
  const p = usePalette()
  return (
    <View style={{ paddingVertical: space.xl, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={p.primary} />
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  const p = usePalette()
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      <Text style={{ color: p.textMuted, fontSize: 13, textAlign: 'center' }}>{body}</Text>
    </View>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const p = usePalette()
  return (
    <View style={{ gap: 2, marginBottom: space.md }}>
      <Text style={{ color: p.textMain, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }}>
        {title}
      </Text>
      {subtitle ? <Text style={{ color: p.textMuted, fontSize: 13 }}>{subtitle}</Text> : null}
    </View>
  )
}

export function ErrorText({ message }: { message: string }) {
  const p = usePalette()
  if (!message) return null
  return <Text style={{ color: p.accent, fontSize: 13 }}>{message}</Text>
}
