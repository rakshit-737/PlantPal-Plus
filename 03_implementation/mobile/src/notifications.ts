/**
 * Push registration — the mobile half of FR-NOT-14.
 *
 * Called on every authenticated cold start and after login: ask permission,
 * fetch the Expo push token, and register it with POST /api/v1/devices. The
 * installation id is a stable UUID minted once per install and kept in the
 * keystore, so the server can tie the token row to this installation across
 * token rotations.
 *
 * Every failure here is silent by design: push is an upgrade to the in-app
 * reminder list, never a requirement, and Expo Go on Android cannot receive
 * remote push at all since SDK 53 — a development build or EAS build can.
 */

import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'

import { apiRequest } from './api/client'

const INSTALLATION_ID_KEY = 'plantpal.installation_id'

function uuidv4(): string {
  // crypto.getRandomValues is available in Hermes/React Native.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function getInstallationId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY)
  if (stored) return stored
  const fresh = uuidv4()
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, fresh)
  return fresh
}

/** Register this device for push reminders. Safe to call repeatedly. */
export async function registerForPushReminders(): Promise<void> {
  try {
    // Simulators and emulators have no push transport.
    if (!Device.isDevice) return

    const { status: existing } = await Notifications.getPermissionsAsync()
    const status =
      existing === 'granted'
        ? existing
        : (await Notifications.requestPermissionsAsync()).status

    const permission_status =
      status === 'granted' ? 'GRANTED' : status === 'denied' ? 'DENIED' : 'UNDETERMINED'

    // A denied device is still registered so the server can drive the
    // "notifications are off" settings banner (FR-NOT-14 rule 5).
    let token: string | null = null
    if (permission_status === 'GRANTED') {
      token = (await Notifications.getExpoPushTokenAsync()).data
    }
    if (!token) return

    await apiRequest('/v1/devices', {
      method: 'POST',
      body: {
        expo_push_token: token,
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        client_installation_id: await getInstallationId(),
        device_label: Device.modelName ?? undefined,
        permission_status,
      },
    })
  } catch {
    // Silent: reminders still arrive in-app via GET /v1/reminders.
  }
}
