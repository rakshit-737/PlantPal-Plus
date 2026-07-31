/**
 * Behaviour tests for the shared primitives. These assert what a user
 * experiences — announced roles, keyboard navigation, focus containment —
 * because that is what the redesign promised and what silently regresses.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Button, Combobox, ErrorState, Modal, Progress, ToastProvider, useToast } from './ui'

describe('Button', () => {
  it('keeps its label while loading so the width does not jump', () => {
    render(<Button loading>Save changes</Button>)
    const button = screen.getByRole('button', { name: /save changes/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})

describe('Modal', () => {
  it('labels the dialog and moves focus into the panel', async () => {
    render(
      <Modal open onClose={() => {}} title="Log workout">
        <button>Save</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Log workout')
    await waitFor(() => expect(dialog).toHaveFocus())
  })

  it('closes on Escape when idle but not while a save is in flight', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open onClose={onClose} title="Add plant" busy>
        <button>Save</button>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    rerender(
      <Modal open onClose={onClose} title="Add plant">
        <button>Save</button>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps Tab inside the panel', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button>Outside</button>
        <Modal open onClose={() => {}} title="Trapped">
          <button>First</button>
          <button>Last</button>
        </Modal>
      </>,
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    // Wrapping keeps focus in the dialog rather than reaching "Outside".
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })
})

function ComboboxHarness({ onPick }: { onPick: (id: string | null) => void }) {
  const [query, setQuery] = useState('')
  const options = [
    { id: 'monstera', label: 'Monstera deliciosa', sub: 'Swiss cheese plant' },
    { id: 'ficus', label: 'Ficus lyrata', sub: 'Fiddle-leaf fig' },
  ].filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
  return (
    <Combobox
      label="Species"
      query={query}
      onQueryChange={setQuery}
      options={options}
      onSelect={(option) => {
        onPick(option?.id ?? null)
        if (option) setQuery(option.label)
      }}
    />
  )
}

describe('Combobox', () => {
  it('exposes combobox semantics and selects with the keyboard', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<ComboboxHarness onPick={onPick} />)

    const input = screen.getByRole('combobox', { name: 'Species' })
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenLastCalledWith('monstera')
    expect(input).toHaveValue('Monstera deliciosa')
  })

  it('clears the selected id when the text is edited afterwards', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<ComboboxHarness onPick={onPick} />)

    const input = screen.getByRole('combobox', { name: 'Species' })
    await user.click(input)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenLastCalledWith('monstera')

    // Typing after a selection must invalidate it — otherwise a stale id
    // rides along under text the user has since changed.
    await user.type(input, 'x')
    expect(onPick).toHaveBeenLastCalledWith(null)
  })
})

describe('ErrorState', () => {
  it('announces itself and offers a retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('Progress', () => {
  it('takes an accessible name from srLabel when no visible label is rendered', () => {
    render(<Progress value={750} max={2000} srLabel="Water intake (ml)" />)
    const bar = screen.getByRole('progressbar', { name: 'Water intake (ml)' })
    expect(bar).toHaveAttribute('aria-valuenow', '750')
    expect(bar).toHaveAttribute('aria-valuemax', '2000')
  })
})

function ToastHarness() {
  const toast = useToast()
  return <button onClick={() => toast.error('Could not log water. Try again.')}>Log water</button>
}

describe('ToastProvider', () => {
  it('announces an error toast and lets it be dismissed', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Log water' }))
    expect(await screen.findByText('Could not log water. Try again.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss notification/i }))
    await waitFor(() =>
      expect(screen.queryByText('Could not log water. Try again.')).not.toBeInTheDocument(),
    )
  })

  it('is a safe no-op outside a provider', async () => {
    const user = userEvent.setup()
    render(<ToastHarness />)
    await user.click(screen.getByRole('button', { name: 'Log water' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
