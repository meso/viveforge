import { render, screen, fireEvent } from '@testing-library/preact'
import { expect, it, describe, vi, beforeEach, afterEach } from 'vitest'
import { Modal, ConfirmModal } from '../Modal'

describe('Modal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  afterEach(() => {
    // Reset body styles
    document.body.style.overflow = ''
  })

  it('should not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose}>
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('should render title when provided', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.getByText('Test Modal')).toBeInTheDocument()
  })

  it('should render close button by default', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.getByLabelText('Close modal')).toBeInTheDocument()
  })

  it('should not render close button when showCloseButton is false', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal" showCloseButton={false}>
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )

    const closeButton = screen.getByLabelText('Close modal')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when overlay is clicked and closeOnOverlayClick is true', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} closeOnOverlayClick={true}>
        <p>Modal content</p>
      </Modal>
    )

    const overlay = screen.getByText('Modal content').closest('.fixed')
    if (overlay) {
      fireEvent.click(overlay)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should not call onClose when modal content is clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} closeOnOverlayClick={true}>
        <p>Modal content</p>
      </Modal>
    )

    const modalContent = screen.getByText('Modal content')
    fireEvent.click(modalContent)

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should call onClose when escape key is pressed', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <p>Modal content</p>
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should set body overflow to hidden when open', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <p>Modal content</p>
      </Modal>
    )

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('should reset body overflow when closed', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <p>Modal content</p>
      </Modal>
    )

    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Modal isOpen={false} onClose={mockOnClose}>
        <p>Modal content</p>
      </Modal>
    )

    expect(document.body.style.overflow).toBe('')
  })

  it('should apply size classes correctly', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose} size="sm">
        <p>Modal content</p>
      </Modal>
    )

    let modalContent = screen.getByText('Modal content').closest('.bg-white')
    expect(modalContent).toHaveClass('max-w-sm')

    rerender(
      <Modal isOpen={true} onClose={mockOnClose} size="lg">
        <p>Modal content</p>
      </Modal>
    )

    modalContent = screen.getByText('Modal content').closest('.bg-white')
    expect(modalContent).toHaveClass('max-w-lg')
  })

  it('should apply custom className', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} className="custom-modal">
        <p>Modal content</p>
      </Modal>
    )

    const modalContent = screen.getByText('Modal content').closest('.bg-white')
    expect(modalContent).toHaveClass('custom-modal')
  })
})

describe('ConfirmModal', () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
    mockOnConfirm.mockClear()
  })

  afterEach(() => {
    // Reset body styles
    document.body.style.overflow = ''
  })

  it('should render confirmation message', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure you want to proceed?"
      />
    )

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
  })

  it('should render default button texts', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
      />
    )

    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('should render custom button texts', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
        cancelText="No"
        confirmText="Yes"
      />
    )

    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('should call onClose when cancel button is clicked', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
      />
    )

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
    expect(mockOnConfirm).not.toHaveBeenCalled()
  })

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
      />
    )

    const confirmButton = screen.getByText('Confirm')
    fireEvent.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should apply danger variant styles', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
        confirmVariant="danger"
      />
    )

    const confirmButton = screen.getByText('Confirm')
    expect(confirmButton).toHaveClass('bg-red-600')
  })

  it('should apply primary variant styles by default', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
      />
    )

    const confirmButton = screen.getByText('Confirm')
    expect(confirmButton).toHaveClass('bg-indigo-600')
  })

  it('should disable buttons when loading', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
        isLoading={true}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    const confirmButton = screen.getByText('Loading...')

    expect(cancelButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
  })

  it('should show loading text when isLoading is true', () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Confirm Action"
        message="Are you sure?"
        isLoading={true}
      />
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })
})