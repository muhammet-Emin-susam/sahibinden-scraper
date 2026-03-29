import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';


function Feed() {
    const { token } = useContext(AuthContext);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedDemand, setSelectedDemand] = useState(null);
    const [myListings, setMyListings] = useState([]);
    const [loadingListings, setLoadingListings] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchFeed();
    }, []);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/feed`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setItems(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyListings = async () => {
        setLoadingListings(true);
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
            setLoadingListings(false);
        }
    };

    const handleSendResponse = async (listing) => {
        if (!selectedDemand || !listing) return;
        setSending(true);
        try {
            const res = await fetch(`${API_BASE_URL}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    demandId: selectedDemand.id,
                    demandTitle: `MÜŞTERİ: ${selectedDemand.clientName} - ${selectedDemand.transactionType} ${selectedDemand.demandType}`,
                    receiverId: selectedDemand.userId,
                    receiverName: selectedDemand.displayName || selectedDemand.username,
                    listingId: listing.id,
                    listingTitle: listing.title,
                    listingUrl: listing.url,
                    text: `Merhaba, paylaştığınız "${selectedDemand.clientName} Müşteri Talebi" için uygun bir ilanım var, inceleyebilirsini:`
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Mesajınız başarıyla gönderildi ve sohbet başlatıldı.');
                setShowModal(false);
            } else {
                alert('Hata: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Mesaj gönderilirken bir hata oluştu.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">Duyurular & Paylaşılanlar</h1>
                    <p className="text-sm text-gray-500 mt-1">İş ortaklarınızın paylaştığı güncel müşteri talepleri</p>
                </div>
                <button
                    onClick={fetchFeed}
                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm"
                    title="Yenile"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                </button>
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path>
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Henüz duyuru yok</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-1">İş ortaklarınız talep paylaştığında burada görünecektir.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map(item => (
                        <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-blue-300 transition-all group overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${item.shareType === 'public' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                            {item.shareType === 'public' ? 'Tüm Danışmanlar' : 'Size Özel'}
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">
                                            {new Date(item.sharedAt || item.createdAt).toLocaleString('tr-TR')}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{item.clientName} Müşteri Talebi</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            {item.transactionType} {item.demandType}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11l-3 3-3-3"></path>
                                            </svg>
                                            {(item.details?.selectedNeighborhoods || []).join(', ') || 'Tüm Bölgeler'}
                                        </span>
                                        {item.details?.maxPrice && (
                                            <span className="text-sm font-bold text-green-600">
                                                Max: {Number(item.details.maxPrice).toLocaleString('tr-TR')} TL
                                            </span>
                                        )}
                                    </div>
                                    {item.details?.description && (
                                        <p className="mt-3 text-sm text-gray-600 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                                            "{item.details.description}"
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-3 min-w-[140px]">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Paylaşan Danışman</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-800">{item.displayName || item.username}</span>
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                                style={{ backgroundColor: item.userColor || '#3b82f6' }}
                                            >
                                                {(item.displayName || item.username || '?')[0].toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 group-hover:shadow-md active:scale-95"
                                        onClick={() => {
                                            setSelectedDemand(item);
                                            setShowModal(true);
                                            fetchMyListings();
                                        }}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                                        </svg>
                                        İlanlarımı Kontrol Et
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !sending && setShowModal(false)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">İlan Gönder</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">Bu talep için uygun ilanınızı seçin</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {loadingListings ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                                    <p className="text-gray-500 font-medium">İlanlarınız yükleniyor...</p>
                                </div>
                            ) : myListings.length === 0 ? (
                                <div className="text-center py-12 px-6">
                                    <h4 className="text-gray-900 font-bold mb-1">Henüz Kaydedilen İlan Yok</h4>
                                    <p className="text-gray-500 text-sm font-medium">Bu talebe uygun bir ilan bulamadık.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {myListings.map(l => (
                                        <div
                                            key={l.id}
                                            onClick={() => !sending && handleSendResponse(l)}
                                            className={`flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all group ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm group-hover:shadow-md transition-all shrink-0">
                                                <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate mb-0.5">{l.title}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">İlan No: {l.ilanNo || '---'}</p>
                                            </div>
                                            <div className="p-2 bg-gray-50 text-gray-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Feed;
