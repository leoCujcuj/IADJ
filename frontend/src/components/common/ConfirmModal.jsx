import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, Trash2, HelpCircle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'warning', // 'danger' | 'warning' | 'info' | 'success'
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  isAlert = false,
  onConfirm,
  onClose
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onClose]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 size={26} className="dialog-icon danger" />;
      case 'warning':
        return <AlertTriangle size={26} className="dialog-icon warning" />;
      case 'info':
        return <Info size={26} className="dialog-icon info" />;
      default:
        return <HelpCircle size={26} className="dialog-icon primary" />;
    }
  };

  return (
    <div className="modal-overlay dialog-overlay" onClick={onClose}>
      <div 
        className={`modal-content dialog-modal ${type}`} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-header">
          <div className="dialog-icon-wrapper">
            {renderIcon()}
          </div>
          <button className="close-btn dialog-close-btn" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <h3 className="dialog-title">{title}</h3>
          <p className="dialog-message">{message}</p>
        </div>

        <div className="dialog-footer">
          {!isAlert && (
            <button 
              type="button" 
              className="dialog-btn secondary" 
              onClick={onClose}
            >
              {cancelText}
            </button>
          )}

          <button 
            type="button" 
            className={`dialog-btn primary ${type}`} 
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
