'use strict';

import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal component that displays content in an overlay dialog.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal should close
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} [props.title] - Optional modal title
 * @param {boolean} [props.closeOnBackdrop=true] - Whether clicking backdrop closes modal
 * @param {boolean} [props.closeOnEscape=true] - Whether pressing Escape closes modal
 * @param {string} [props.size='medium'] - Modal size: 'small', 'medium', 'large', 'fullscreen'
 * @param {string} [props.className] - Additional CSS class for the modal
 * @returns {React.ReactElement|null} The modal component or null
 */
export const Modal = ({
  isOpen,
  onClose,
  children,
  title,
  closeOnBackdrop = true,
  closeOnEscape = true,
  size = 'medium',
  className = '',
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  /**
   * handleKeyDown handles keyboard events for the modal.
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose();
      }

      // Trap focus within modal
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [closeOnEscape, onClose]
  );

  /**
   * handleBackdropClick handles clicks on the modal backdrop.
   */
  const handleBackdropClick = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);

      // Focus the modal
      setTimeout(() => {
        const focusableElement = modalRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusableElement?.focus();
      }, 0);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className="modal-overlay" onClick={handleBackdropClick} role="presentation">
      <div
        ref={modalRef}
        className={`modal modal--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="modal__header">
            <h2 id="modal-title" className="modal__title">
              {title}
            </h2>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close modal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
