import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const ToastItem = React.memo(({ toast, onHide }) => {
    const handleClose = useCallback(() => {
        onHide(toast.id);
    }, [onHide, toast.id]);

    return (
        <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={handleClose}
        />
    );
});

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success', duration = 3000) => {
        console.log("SHOW TOAST TRIGGERED:", message, type, duration);
        const id = Date.now() + Math.random();
        const newToast = { id, message, type, duration };

        setToasts(prev => {
            console.log("Current toasts:", prev, "Adding new:", newToast);
            return [...prev, newToast];
        });

        return id;
    }, []);

    const hideToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showSuccess = useCallback((message, duration = 3000) => showToast(message, 'success', duration), [showToast]);
    const showError = useCallback((message, duration = 3000) => showToast(message, 'error', duration), [showToast]);
    const showWarning = useCallback((message, duration = 3000) => showToast(message, 'warning', duration), [showToast]);
    const showInfo = useCallback((message, duration = 3000) => showToast(message, 'info', duration), [showToast]);

    const contextValue = useMemo(() => ({
        showToast,
        hideToast,
        showSuccess,
        showError,
        showWarning,
        showInfo
    }), [showToast, hideToast, showSuccess, showError, showWarning, showInfo]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            {typeof document !== 'undefined' && createPortal(
                <div className="custom-toast-container">
                    {toasts.map(toast => (
                        <ToastItem
                            key={toast.id}
                            toast={toast}
                            onHide={hideToast}
                        />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};
