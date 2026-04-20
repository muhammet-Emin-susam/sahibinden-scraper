import React from 'react';
import { useNotification } from '../contexts/NotificationContext';

const Toast = ({ toast, onRemove }) => {
    const icons = {
        success: (
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        warning: (
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        info: (
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    };

    const bgColors = {
        success: 'bg-emerald-50 border-emerald-100',
        error: 'bg-rose-50 border-rose-100',
        warning: 'bg-amber-50 border-amber-100',
        info: 'bg-blue-50 border-blue-100'
    };

    return (
        <div className={`flex items-center gap-3 p-4 pr-12 rounded-2xl border shadow-xl animate-slide-in-right mb-3 relative overflow-hidden group min-w-[300px] max-w-md bg-white/80 backdrop-blur-md ${bgColors[toast.type] || bgColors.info}`}>
            <div className={`p-2 rounded-xl bg-white shadow-sm flex-shrink-0`}>
                {icons[toast.type] || icons.info}
            </div>
            <div className="flex flex-col">
                <p className="text-sm font-bold text-gray-800">{toast.message}</p>
            </div>
            <button 
                onClick={() => onRemove(toast.id)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="absolute bottom-0 left-0 h-1 bg-gray-200/20 w-full">
                <div className={`h-full opacity-50 animate-progress ${toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`} />
            </div>
        </div>
    );
};

const NotificationContainer = () => {
    const { toasts, modal, closeModal, removeToast } = useNotification();

    return (
        <>
            {/* Toast Container */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <Toast toast={toast} onRemove={removeToast} />
                    </div>
                ))}
            </div>

            {/* Modal Alert/Confirm */}
            {modal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-scale-up border border-gray-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`p-3 rounded-2xl ${modal.type === 'confirm' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                {modal.type === 'confirm' ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                )}
                            </div>
                            <h2 className="text-xl font-black text-gray-800">{modal.title}</h2>
                        </div>
                        <p className="text-gray-600 font-medium mb-8 leading-relaxed">
                            {modal.message}
                        </p>
                        <div className="flex gap-3 justify-end items-center">
                            {modal.type === 'confirm' ? (
                                <>
                                    <button 
                                        onClick={() => closeModal(false)}
                                        className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                    >
                                        Vazgeç
                                    </button>
                                    <button 
                                        onClick={() => closeModal(true)}
                                        className="px-8 py-2.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                    >
                                        Evet, Onayla
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => closeModal(true)}
                                    className="px-10 py-2.5 rounded-xl font-black text-white bg-gray-800 hover:bg-black shadow-lg transition-all active:scale-95"
                                >
                                    Tamam
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-up {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                .animate-slide-in-right { animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
                .animate-scale-up { animation: scale-up 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-progress { animation: progress 5s linear forwards; }
            `}} />
        </>
    );
};

export default NotificationContainer;
