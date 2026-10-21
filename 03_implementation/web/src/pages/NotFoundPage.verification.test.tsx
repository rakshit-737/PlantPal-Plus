/**
 * Verification of the 404 screen (FR-SYS navigation, NFR-USAB).
 * Test IDs: TC-SYS-301 ..
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from './NotFoundPage'

const renderPage = () => render(<MemoryRouter><NotFoundPage /></MemoryRouter>)

describe('NotFoundPage', () => {
  it('TC-SYS-301 shows a level-one heading and the 404 figure', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Not in the ledger.')
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('TC-SYS-302 the decorative status code is hidden from assistive technology', () => {
    renderPage()
    expect(screen.getByText('404')).toHaveAttribute('aria-hidden', 'true')
  })

  it('TC-SYS-303 offers one way back, to the root, which works for signed-in and signed-out visitors', () => {
    renderPage()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/')
  })

  it('TC-SYS-304 sets a descriptive document title', () => {
    renderPage()
    expect(document.title).toMatch(/Page not found/)
  })

  it('TC-SYS-305 the message does not echo the requested address (no reflected content)', () => {
    window.history.pushState({}, '', '/<script>alert(1)</script>')
    const { container } = renderPage()
    expect(container.innerHTML).not.toContain('<script>')
  })
})
