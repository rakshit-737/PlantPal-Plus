/**
 * UI primitives — the React Native mirror of apps/web/src/components/ui.tsx.
 * Small on purpose: Card, Button, Input, Badge, Spinner, EmptyState cover
 * every screen without pulling in a component library.
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
  type ViewStyle,
} from 'react-native'

import { usePalette, space } from '../theme'

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
          borderRadius: 12,
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
  const background =
    variant === 'primary'
      ? p.primary
      : variant === 'danger'
        ? p.danger
        : variant === 'secondary'
          ? p.surface
          : 'transparent'
  const color = variant === 'primary' || variant === 'danger' ? '#ffffff' : p.textMain
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: background,
        borderColor: variant === 'secondary' ? p.border : 'transparent',
        borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: space.md,
        alignItems: 'center',
        opacity: disabled || loading ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={{ color, fontWeight: '600', fontSize: 15 }}>{title}</Text>
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
      {label ? (
        <Text style={{ color: p.textMain, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      ) : null}
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
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: space.md,
          color: p.textMain,
          fontSize: 15,
        }}
      />
    </View>
  )
}

export function Badge({ text, color }: { text: string; color?: string }) {
  const p = usePalette()
  const tone = color ?? p.primary
  return (
    <View
      style={{
        backgroundColor: `${tone}22`,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: tone, fontSize: 12, fontWeight: '600' }}>{text}</Text>
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
      <Text style={{ color: p.textMain, fontSize: 24, fontWeight: '700' }}>{title}</Text>
      {subtitle ? <Text style={{ color: p.textMuted, fontSize: 13 }}>{subtitle}</Text> : null}
    </View>
  )
}

export function ErrorText({ message }: { message: string }) {
  const p = usePalette()
  if (!message) return null
  return <Text style={{ color: p.danger, fontSize: 13 }}>{message}</Text>
}
