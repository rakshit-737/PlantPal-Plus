/**
 * Shared fetch-failure state. Rendered when a screen's load() cannot reach
 * the server — deliberately distinct from empty states, which mean the server
 * answered with no rows.
 */

import { Text } from 'react-native'

import { usePalette, space } from '../theme'
import { Button, Card } from './ui'

export function OfflineNotice({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void
  retrying?: boolean
}) {
  const p = usePalette()
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={{ color: p.textMain, fontSize: 15, fontWeight: '600' }}>
        Couldn&apos;t reach the server
      </Text>
      <Text style={{ color: p.textMuted, fontSize: 13 }}>
        Check your connection and try again.
      </Text>
      <Button title="Retry" variant="secondary" loading={retrying} onPress={onRetry} />
    </Card>
  )
}
