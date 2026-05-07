import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmModal.css';

/**
 * A modern, reusable confirmation modal component.
 * 
 * @param {boolean} isOpen - Controls if the modal is visible.
 * @param {string} title - The title text of the modal.
 * @param {string} message - The body message of the modal.
 * @param {function} onConfirm - Callback for when the confirm button is clicked.
 * @param {function} onCancel - Callback for when the cancel button or backdrop is clicked.
 * @param {string} confirmText - Text for the confirm button (default: "Confirm").
 * @param {string} cancelText - Text for the cancel button (default: "Cancel").
 * @param {string} variant - Visual variant (default: "primary", "danger", etc.).
 */
const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary"
}) => {
  // Handle ESC key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      onCancel();
    }
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent scrolling on the body when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div 
        className="confirm-modal-container" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="confirm-modal-header">
          <h3 id="modal-title">{title}</h3>
          <button className="confirm-modal-close-btn" onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button 
            className="confirm-modal-btn btn-cancel" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-modal-btn btn-confirm variant-${variant}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
