import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';


function Messages() {
    const { token, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessageText, setNewMessageText] = useState('');
    const [attachmentListing, setAttachmentListing] = useState(null);
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [myListings, setMyListings] = useState([]);
    const [loadingMyListings, setLoadingMyListings] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 60000); // 1 minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedConv) {
            fetchMessages(selectedConv.demandId, selectedConv.otherUserId);
            const interval = setInterval(() => {
                fetchMessages(selectedConv.demandId, selectedConv.otherUserId);
            }, 60000); // 1 minute
            return () => clearInterval(interval);
        }
    }, [selectedConv]);

    const fetchConversations = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                console.log(`[FRONTEND] Fetched ${data.data.length} conversations`);
                setConversations(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingConversations(false);
        }
    };

    const fetchMessages = async (demandId, otherUserId) => {
        try {
            const url = otherUserId
                ? `${API_BASE_URL}/messages/${demandId}?otherUserId=${otherUserId}`
                : `${API_BASE_URL}/messages/${demandId}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                console.log(`[FRONTEND] Fetched ${data.data.length} messages for demand ${demandId}`);
                setMessages(data.data);
                setTimeout(scrollToBottom, 100);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMyListings = async () => {
        setLoadingMyListings(true);
        try {
            const res = await fetch(`${API_BASE_URL}/records`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                // "Kaydedilenler" list corresponds to status 'approved' or 'matched'
                const savedListings = data.data.filter(l =>
                    l.status === 'approved' || l.status === 'matched'
                );
                setMyListings(savedListings);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMyListings(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!selectedConv) return;
        if (!newMessageText.trim() && !attachmentListing) return;

        // Ensure text is not empty if there is an attachment but no message typed
        const finalMessageText = newMessageText.trim() || (attachmentListing ? 'Bu ilanı paylaştı:' : '');

        if (!finalMessageText) return;

        try {
            const res = await fetch(`${API_BASE_URL}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    demandId: selectedConv.demandId,
                    demandTitle: selectedConv.demandTitle,
                    receiverId: selectedConv.otherUserId,
                    receiverName: selectedConv.otherUserName,
                    listingId: attachmentListing?.id || null,
                    listingTitle: attachmentListing?.title || null,
                    listingUrl: attachmentListing?.url || null,
                    text: finalMessageText,
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessages([...messages, data.data]);
                setNewMessageText('');
                setAttachmentListing(null);
                fetchConversations(); // Update inbox summary
                setTimeout(scrollToBottom, 50);
            }
        } catch (err) {
            console.error(err);
            alert('Mesaj gönderilemedi');
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 pb-6">
            {/* Inbox Sidebar */}
            <div className={`w-full md:w-80 lg:w-96 flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-800">Mesajlar</h2>
                    <span className="bg-blue-100 text-blue-600 text-xs font-black px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        {conversations.length} Sohbet
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loadingConversations ? (
                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center p-12">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <h3 className="text-gray-900 font-bold mb-1">Henüz Mesaj Yok</h3>
                            <p className="text-gray-500 text-xs px-6">Talepleri paylaşarak diğer danışmanlarla iletişime geçebilirsiniz.</p>
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={`${conv.demandId}-${conv.otherUserId}`}
                                onClick={() => setSelectedConv(conv)}
                                className={`p-5 border-b border-gray-50 cursor-pointer transition-all hover:bg-gray-50 flex gap-4 items-start relative ${selectedConv?.demandId === conv.demandId ? 'bg-blue-50/50 border-l-4 border-l-blue-500 shadow-sm z-10' : ''}`}
                            >
                                <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600`}>
                                    {(conv.otherUserName || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-sm font-black text-gray-900 truncate">{conv.otherUserName}</h4>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium">{new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-tighter mb-1.5 truncate">#{conv.demandTitle}</p>
                                    <p className="text-xs text-gray-500 line-clamp-1 italic font-medium">"{conv.lastMessage}"</p>
                                </div>
                                {conv.unreadCount > 0 && (
                                    <div className="absolute right-4 bottom-5 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-pulse">
                                        {conv.unreadCount}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden ${!selectedConv ? 'hidden md:flex' : 'flex'}`}>
                {selectedConv ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedConv(null)} className="md:hidden p-2 text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-inner">
                                    {(selectedConv.otherUserName || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 leading-none">{selectedConv.otherUserName}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tight shadow-sm cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => navigate('/sayfalar/talepler', { state: { selectedDemandId: selectedConv.demandId } })}>
                                            {selectedConv.demandTitle}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30 custom-scrollbar">
                            {messages.map((m, index) => {
                                const showDate = index === 0 || new Date(m.createdAt).toLocaleDateString() !== new Date(messages[index - 1].createdAt).toLocaleDateString();
                                return (
                                    <React.Fragment key={m.id}>
                                        {showDate && (
                                            <div className="flex justify-center my-4">
                                                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 border border-gray-100 uppercase tracking-widest shadow-sm">
                                                    {new Date(m.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                                </span>
                                            </div>
                                        )}
                                        <div className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${m.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                                                <div className={`p-4 rounded-2xl shadow-sm text-sm ${m.senderId === user?.id ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none font-medium'}`}>

                                                    {m.listingTitle && (
                                                        <div
                                                            onClick={() => {
                                                                const targetUrl = m.listingUrl || m.url;
                                                                if (targetUrl) {
                                                                    window.open(targetUrl, '_blank');
                                                                } else {
                                                                    navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: m.listingId } });
                                                                }
                                                            }}
                                                            className={`mb-2 p-2 rounded-lg text-[10px] border flex flex-col gap-1 cursor-pointer transition-all hover:brightness-95 active:scale-[0.98] ${m.senderId === user?.id ? 'bg-white/10 border-white/20 text-blue-100 hover:bg-white/20' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-black uppercase tracking-widest opacity-60">İLGİLİ İLAN</span>
                                                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                            </div>
                                                            <span className="font-bold truncate">{m.listingTitle}</span>
                                                        </div>
                                                    )}
                                                    {m.text}
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1 px-1 font-bold">
                                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                            {attachmentListing && (
                                <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200 shadow-sm">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-70">Paylaşılacak İlan</span>
                                        </div>
                                        <p className="text-xs font-bold text-blue-900 truncate">{attachmentListing.title}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAttachmentListing(null)}
                                        className="p-1.5 text-blue-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                                    >
                                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowAttachmentModal(true); fetchMyListings(); }}
                                    className={`p-3 rounded-2xl border transition-all active:scale-[0.95] flex items-center justify-center ${attachmentListing ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200'}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                </button>
                                <input
                                    value={newMessageText}
                                    onChange={e => setNewMessageText(e.target.value)}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium placeholder-gray-400"
                                    placeholder="Mesajınızı yazın..."
                                />
                                <button type="submit" className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 uppercase tracking-wider text-xs flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    Gönder
                                </button>
                            </div>
                        </form>
                        <AttachmentModal
                            isOpen={showAttachmentModal}
                            onClose={() => setShowAttachmentModal(false)}
                            listings={myListings}
                            loading={loadingMyListings}
                            onSelect={setAttachmentListing}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/50">
                        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/10 border border-gray-100 animate-bounce">
                            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Sohbete Başla</h3>
                        <p className="text-gray-500 max-w-sm font-medium">Danışmanlar arasındaki iletişimi yönetmek için sol menüden bir sohbet seçin.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function AttachmentModal({ isOpen, onClose, listings, loading, onSelect }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">İlan Ekle</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">Kaydedilen ilanlarınız arasından seçim yapın</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-500 font-medium animate-pulse">İlanlar yükleniyor...</p>
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="text-center py-12 px-6">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-200">
                                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </div>
                            <h4 className="text-gray-900 font-bold mb-1">Henüz Kaydedilen İlan Yok</h4>
                            <p className="text-gray-500 text-sm font-medium">Koleksiyonlarınıza eklediğiniz ilanlar burada listelenir.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {listings.map(l => (
                                <div
                                    key={l.id}
                                    onClick={() => { onSelect(l); onClose(); }}
                                    className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all group"
                                >
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm group-hover:shadow-md transition-all shrink-0">
                                        <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate mb-0.5">{l.title}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">İlan No: {l.ilanNo || '---'}</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 text-gray-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Messages;
