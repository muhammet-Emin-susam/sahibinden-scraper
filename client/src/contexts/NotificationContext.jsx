import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [modal, setModal] = useState(null); // { type: 'alert'|'confirm', title, message, resolve }

    const showToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const showAlert = useCallback((title, message) => {
        return new Promise((resolve) => {
            setModal({ type: 'alert', title, message, resolve });
        });
    }, []);

    const showConfirm = useCallback((title, message) => {
        return new Promise((resolve) => {
            setModal({ type: 'confirm', title, message, resolve });
        });
    }, []);

    const closeModal = (result) => {
        if (modal && modal.resolve) {
            modal.resolve(result);
        }
        setModal(null);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showToast, showAlert, showConfirm, toasts, modal, closeModal, removeToast }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
