import React, { useState, useEffect, useCallback } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);

    const handleClose = useCallback(() => {
        setIsLeaving(true);
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        if (message) {
            setIsLeaving(false);

            const timer = setTimeout(() => {
                handleClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [message, duration, handleClose]);

    if (!isVisible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '';
            case 'info':
                return 'ℹ';
            default:
                return '✓';
        }
    };

    return (
        <div className={`custom-toast custom-toast-${type} ${isLeaving ? 'custom-toast-leaving' : ''}`}>
            <div className="custom-toast-content">
                <div className="custom-toast-icon">{getIcon()}</div>
                <div className="custom-toast-message">{message}</div>
                <button className="custom-toast-close" onClick={handleClose}>
                    ×
                </button>
            </div>
            <div className="custom-toast-progress">
                <div
                    className="custom-toast-progress-bar"
                    style={{
                        animation: `custom-toast-progress ${duration}ms linear forwards`
                    }}
                />
            </div>
        </div>
    );
};

export default Toast;
