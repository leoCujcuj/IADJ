import { useState, useCallback } from 'react';

/**
 * Hook modular para gestion centralizada de alertas y confirmaciones modales.
 * Reemplaza los popups nativos bloqueantes (alert/confirm) del navegador.
 */
export default function useDialog() {
  const [modalDialog, setModalDialog] = useState(null);

  const showConfirm = useCallback(({ title, message, type = 'warning', confirmText = 'Aceptar', cancelText = 'Cancelar' }) => {
    return new Promise((resolve) => {
      setModalDialog({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        cancelText,
        isAlert: false,
        onConfirm: () => {
          setModalDialog(null);
          resolve(true);
        },
        onClose: () => {
          setModalDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  const showAlert = useCallback(({ title, message, type = 'info', confirmText = 'Entendido' }) => {
    return new Promise((resolve) => {
      setModalDialog({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        isAlert: true,
        onConfirm: () => {
          setModalDialog(null);
          resolve(true);
        },
        onClose: () => {
          setModalDialog(null);
          resolve(true);
        }
      });
    });
  }, []);

  return {
    modalDialog,
    setModalDialog,
    showConfirm,
    showAlert
  };
}
