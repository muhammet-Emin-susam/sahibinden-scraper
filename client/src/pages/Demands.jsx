import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

function Demands() {
    const { token, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [demands, setDemands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'view'
    const [selectedDemand, setSelectedDemand] = useState(null);
    const [saving, setSaving] = useState(false);
    const [removingMatchId, setRemovingMatchId] = useState(null);

    const [formData, setFormData] = useState({ clientName: '', clientPhone: '' });
    const [demandType, setDemandType] = useState('Konut'); // Konut, Arsa, Ticari
    const [transactionType, setTransactionType] = useState('Satılık'); // Satılık, Kiralık
    const [availableLocations, setAvailableLocations] = useState({});
    const [selectedNeighborhoods, setSelectedNeighborhoods] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [details, setDetails] = useState({});

    // Suggestions states
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [activeTab, setActiveTab] = useState('matches'); // 'matches', 'suggestions', 'colleagueMatches'
    const [matchingSuggestionId, setMatchingSuggestionId] = useState(null);

    // Sharing states
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharingDemandId, setSharingDemandId] = useState(null);
    const [colleagueMatches, setColleagueMatches] = useState([]);
    const [loadingColleagueMatches, setLoadingColleagueMatches] = useState(false);
    const [users, setUsers] = useState([]);

    // Messaging states
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatReceiverId, setChatReceiverId] = useState(null);
    const [chatReceiverName, setChatReceiverName] = useState('');
    const [chatDemandId, setChatDemandId] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [chatListingId, setChatListingId] = useState(null);
    const [chatListingTitle, setChatListingTitle] = useState(null);

    useEffect(() => {
        fetchDemands();
        fetchAvailableLocations();
        fetchUsers();
    }, []);

    useEffect(() => {
        let interval;
        if (showChat && chatDemandId && chatReceiverId) {
            interval = setInterval(() => {
                fetchConversation(chatDemandId, chatReceiverId);
            }, 60000); // 1 minute
        }
        return () => clearInterval(interval);
    }, [showChat, chatDemandId, chatReceiverId]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setUsers(data.data.filter(u => u.id !== user?.id));
            }
        } catch (e) { console.error(e); }
    };

    const fetchAvailableLocations = async () => {
        try {
            const res = await fetch('/api/records', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                const map = {};
                data.data.forEach(r => {
                    if (r.status === 'approved' && r.location) {
                        const parts = r.location.split('/').map(p => p.trim());
                        if (parts.length >= 3) {
                            map[parts[2]] = { city: parts[0], district: parts[1], neighborhood: parts[2] };
                        }
                    }
                });
                setAvailableLocations(map);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (showModal && modalMode === 'view' && selectedDemand?.id) {
            fetchSuggestions(selectedDemand.id);
            fetchColleagueMatches(selectedDemand.id);
            setActiveTab('matches');
        } else {
            setSuggestions([]);
            setColleagueMatches([]);
        }
    }, [showModal, selectedDemand?.id]);

    const fetchColleagueMatches = async (demandId) => {
        setLoadingColleagueMatches(true);
        try {
            const res = await fetch(`/api/demands/${demandId}/colleague-matches`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setColleagueMatches(data.data);
            }
        } catch (err) {
            console.error("Error fetching colleague matches:", err);
        } finally {
            setLoadingColleagueMatches(false);
        }
    };

    const fetchSuggestions = async (demandId) => {
        setLoadingSuggestions(true);
        try {
            const res = await fetch(`/api/demands/${demandId}/suggestions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSuggestions(data.data);
            }
        } catch (err) {
            console.error("Error fetching suggestions:", err);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const fetchConversation = async (demandId, otherUserId) => {
        setLoadingMessages(true);
        try {
            const url = otherUserId 
                ? `/api/messages/${demandId}?otherUserId=${otherUserId}`
                : `/api/messages/${demandId}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                console.log(`[DEMANDS] Fetched ${data.data.length} messages for demand ${demandId}`);
                setChatMessages(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!newMessageText.trim() || !chatReceiverId || !chatDemandId) return;

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    demandId: chatDemandId,
                    demandTitle: selectedDemand?.clientName ? `${selectedDemand.clientName} Talebi` : 'Bir Talep',
                    receiverId: chatReceiverId,
                    receiverName: chatReceiverName,
                    listingId: chatListingId,
                    listingTitle: chatListingTitle,
                    text: newMessageText
                })
            });
            console.log(`[DEMANDS] Sending message to ${chatReceiverId}`, { listingId: chatListingId, demandId: chatDemandId });
            const data = await res.json();
            if (data.success) {
                setChatMessages(prev => [...prev, data.data]);
                setNewMessageText('');
                setChatListingId(null);
                setChatListingTitle(null);
            }
        } catch (err) {
            console.error(err);
            alert('Mesaj gönderilemedi.');
        }
    };

    const fetchDemands = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/demands`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setDemands(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Bu talebi silmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetch(`/api/demands/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setDemands(demands.filter(d => d.id !== id));
            }
        } catch (err) {
            console.error(err);
            alert('Silme başarısız');
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            const res = await fetch(`/api/demands/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                setDemands(demands.map(d => d.id === id ? { ...d, status: newStatus } : d));
                if (selectedDemand && selectedDemand.id === id) {
                    setSelectedDemand({ ...selectedDemand, status: newStatus });
                }
            } else {
                alert('Durum güncellenemedi: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Durum güncellenirken bir hata oluştu.');
        }
    };

    const handleCreateDemand = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const groups = {};
            selectedNeighborhoods.forEach(n => {
                const info = availableLocations[n];
                if (info) {
                    const key = `${info.city}|${info.district}`;
                    if (!groups[key]) groups[key] = { city: info.city, district: info.district, neighborhoods: [] };
                    groups[key].neighborhoods.push(info.neighborhood);
                }
            });
            const locations = Object.values(groups);

            const res = await fetch(`/api/demands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientName: formData.clientName,
                    clientPhone: formData.clientPhone,
                    demandType,
                    transactionType,
                    details,
                    locations
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                fetchDemands();
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Kayıt başarısız');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateDemand = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const groups = {};
            selectedNeighborhoods.forEach(n => {
                const info = availableLocations[n];
                if (info) {
                    const key = `${info.city}|${info.district}`;
                    if (!groups[key]) groups[key] = { city: info.city, district: info.district, neighborhoods: [] };
                    groups[key].neighborhoods.push(info.neighborhood);
                }
            });
            const locations = Object.values(groups);

            const res = await fetch(`/api/demands/${selectedDemand.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientName: formData.clientName,
                    clientPhone: formData.clientPhone,
                    demandType,
                    transactionType,
                    details,
                    locations
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                fetchDemands();
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Güncelleme başarısız');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMatch = async (e, demandId, listingId) => {
        e.stopPropagation();
        if (!window.confirm('Bu ilanı talepten çıkarmak istediğinize emin misiniz?')) return;

        setRemovingMatchId(listingId);
        try {
            const res = await fetch(`/api/demands/${demandId}/match/${listingId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (data.success) {
                // Update local selected demand and demands list
                const updateMatched = (prev) => prev.map(d => {
                    if (d.id === demandId) {
                        return { ...d, matchedListings: d.matchedListings.filter(l => l.listingId !== listingId) };
                    }
                    return d;
                });
                setDemands(updateMatched);
                if (selectedDemand && selectedDemand.id === demandId) {
                    setSelectedDemand(prev => ({ ...prev, matchedListings: prev.matchedListings.filter(l => l.listingId !== listingId) }));
                }
            } else {
                alert(data.error || 'İlan çıkarılırken bir hata oluştu.');
            }
        } catch (err) {
            console.error('Failed to remove match:', err);
            alert('İşlem başarısız oldu.');
        } finally {
            setRemovingMatchId(null);
        }
    };

    const handleMatchSuggestion = async (e, listing) => {
        e.stopPropagation();
        setMatchingSuggestionId(listing.listingId);
        try {
            const parts = (listing.location || '').split('/').map(p => p.trim());
            const city = parts[0] || '';
            const district = parts[1] || '';
            const neighborhood = parts[2] || '';

            const res = await fetch(`/api/demands/${selectedDemand.id}/match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    listing: {
                        id: listing.listingId,
                        title: listing.title,
                        price: listing.price,
                        city,
                        district,
                        neighborhood,
                        sellerName: listing.sellerName,
                        sellerPhone: listing.sellerPhone,
                        properties: { 'İlan No': listing.ilanNo }
                    }
                })
            });

            const data = await res.json();
            if (data.success) {
                setSuggestions(prev => prev.filter(s => s.listingId !== listing.listingId));

                const newMatch = {
                    listingId: listing.listingId,
                    title: listing.title,
                    price: listing.price,
                    city, district, neighborhood,
                    dateAdded: new Date().toISOString(),
                    sellerName: listing.sellerName || '',
                    sellerPhone: listing.sellerPhone || '',
                    ilanNo: listing.ilanNo || ''
                };

                setSelectedDemand(prev => ({ ...prev, matchedListings: [...(prev.matchedListings || []), newMatch] }));
                setDemands(prev => prev.map(d => d.id === selectedDemand.id ? { ...d, matchedListings: [...(d.matchedListings || []), newMatch] } : d));
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Eşleştirme başarısız');
        } finally {
            setMatchingSuggestionId(null);
        }
    };

    const handleShareDemand = async (demandId, shareType, sharedWithIds = []) => {
        try {
        const res = await fetch(`/api/demands/${demandId}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shareType, sharedWithIds })
        });
        const data = await res.json();
        if (data.success) {
            setDemands(prev => prev.map(d => d.id === demandId ? { ...d, shareType, sharedWithIds } : d));
            setShowShareModal(false);
            alert('Talep paylaşıldı.');
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Paylaşım hatası');
    }
};

const openCreateModal = () => {
    setFormData({ clientName: '', clientPhone: '' });
    setDemandType('Konut');
    setTransactionType('Satılık');
    setSelectedNeighborhoods([]);
    setIsDropdownOpen(false);
    setDetails({});
    setModalMode('create');
    setShowModal(true);
};

const openEditModal = () => {
    setFormData({ clientName: selectedDemand.clientName || '', clientPhone: selectedDemand.clientPhone || '' });
    setDemandType(selectedDemand.demandType || 'Konut');
    setTransactionType(selectedDemand.transactionType || 'Satılık');
    setDetails(selectedDemand.details || {});

    const nList = [];
    if (selectedDemand.locations) {
        selectedDemand.locations.forEach(loc => {
            if (loc.neighborhoods) {
                nList.push(...loc.neighborhoods);
            }
        });
    }
    setSelectedNeighborhoods(nList);
    setIsDropdownOpen(false);
    setModalMode('edit');
};

const openViewModal = (demand) => {
    setSelectedDemand(demand);
    setModalMode('view');
    setShowModal(true);
};

return (
    <div className="pb-20">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center px-4 md:px-0 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Müşteri Talepleri
                </h2>
                <p className="text-gray-500 mt-1">Gelen kiralık/satılık taleplerini takip edin ve uygun ilanlarla eşleştirin.</p>
            </div>
            <button
                onClick={openCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Yeni Talep Oluştur
            </button>
        </header>

        <div className="px-4 md:px-0">
            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
            ) : demands.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">Henüz Talep Yok</h3>
                    <p className="text-gray-500">Yeni bir müşteri talebi oluşturarak başlayın.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {demands.map(demand => (
                        <div
                            key={demand.id}
                            onClick={() => openViewModal(demand)}
                            className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-2 flex-wrap">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg border shadow-sm ${demand.transactionType === 'Satılık' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                        {demand.transactionType}
                                    </span>
                                    <span className="px-3 py-1 text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm rounded-lg">
                                        {demand.demandType}
                                    </span>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg border shadow-sm ${demand.status === 'Tamamlandı' ? 'bg-green-50 text-green-600 border-green-200' :
                                        demand.status === 'İptal' ? 'bg-red-50 text-red-600 border-red-200' :
                                            demand.status && demand.status !== 'Aktif' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                        {demand.status || 'Aktif'}
                                    </span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSharingDemandId(demand.id); setShowShareModal(true); }}
                                        className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 rounded-lg"
                                        title="Paylaş"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(demand.id, e)}
                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-lg"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">{demand.clientName}</h3>
                            <p className="text-sm text-gray-500 mb-4 flex items-center gap-1 font-medium">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                {demand.clientPhone || 'Belirtilmedi'}
                            </p>
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                                    Eşleşen İlan: <strong className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shadow-sm">{demand.matchedListings?.length || 0}</strong>
                                </span>
                                <span className="text-xs text-gray-400 font-medium">
                                    {new Date(demand.createdAt).toLocaleDateString('tr-TR')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Create / Edit Modal */}
        {showModal && (modalMode === 'create' || modalMode === 'edit') && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl relative z-10 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-xl font-bold text-gray-900">{modalMode === 'create' ? 'Yeni Müşteri Talebi' : 'Talebi Düzenle'}</h3>
                        <button onClick={() => {
                            setShowModal(modalMode === 'edit');
                            if (modalMode === 'edit') setModalMode('view');
                        }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={modalMode === 'create' ? handleCreateDemand : handleUpdateDemand} className="overflow-y-auto flex-1 p-6 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Müşteri Adı Soyadı</label>
                                <input
                                    required
                                    value={formData.clientName}
                                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                    placeholder="Örn: Ahmet Yılmaz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Telefon</label>
                                <input
                                    value={formData.clientPhone}
                                    maxLength={17} // +90 555 555 55 55
                                    onChange={e => {
                                        let cleaned = e.target.value.replace(/\D/g, '');
                                        // Handle potential pastes of international formats and local variants
                                        if (cleaned.startsWith('90')) cleaned = cleaned.substring(2);
                                        else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

                                        // Ensure only 10 digits are processed
                                        cleaned = cleaned.substring(0, 10);

                                        if (!cleaned) {
                                            setFormData({ ...formData, clientPhone: '' });
                                            return;
                                        }

                                        // Format as +90 XXX XXX XX XX
                                        const match = cleaned.match(/(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
                                        if (match) {
                                            let formatted = '+90';
                                            if (match[1]) formatted += ' ' + match[1];
                                            if (match[2]) formatted += ' ' + match[2];
                                            if (match[3]) formatted += ' ' + match[3];
                                            if (match[4]) formatted += ' ' + match[4];
                                            setFormData({ ...formData, clientPhone: formatted.trim() });
                                        }
                                    }}
                                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                    placeholder="+90 555 555 55 55"
                                />
                            </div>
                        </div>

                        <div className="p-1 bg-gray-100 rounded-xl flex gap-1 mb-6 shadow-inner">
                            {['Konut', 'Arsa', 'Ticari'].map(t => (
                                <button
                                    key={t} type="button"
                                    onClick={() => setDemandType(t)}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${demandType === t ? 'bg-white text-indigo-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4 mb-8">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={transactionType === 'Satılık'} onChange={() => setTransactionType('Satılık')} className="text-indigo-600 w-4 h-4" />
                                <span className="font-medium text-gray-700">Satılık</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={transactionType === 'Kiralık'} onChange={() => setTransactionType('Kiralık')} className="text-indigo-600 w-4 h-4" />
                                <span className="font-medium text-gray-700">Kiralık</span>
                            </label>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2">Kriterler</h4>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 relative">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Bölge (Mahalle Seçimi)</label>
                                    <div
                                        className="w-full min-h-[46px] bg-white border border-gray-200 rounded-xl px-3 py-2 cursor-pointer flex flex-wrap gap-2 items-center"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    >
                                        {selectedNeighborhoods.length === 0 && <span className="text-gray-400 font-medium">Mahalle Seçin...</span>}
                                        {selectedNeighborhoods.map(n => (
                                            <span key={n} className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-1 rounded-lg text-xs flex items-center gap-1 shadow-sm">
                                                {n}
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedNeighborhoods(prev => prev.filter(x => x !== n)); }} className="hover:text-indigo-900">&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                    {isDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 shadow-xl rounded-xl max-h-60 overflow-y-auto custom-scrollbar">
                                            {Object.keys(availableLocations).sort().map(n => (
                                                <div
                                                    key={n}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                    onClick={() => setSelectedNeighborhoods(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedNeighborhoods.includes(n) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                        {selectedNeighborhoods.includes(n) && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <span className={`text-sm ${selectedNeighborhoods.includes(n) ? 'font-bold text-indigo-900' : 'font-medium text-gray-700'}`}>{n}</span>
                                                </div>
                                            ))}
                                            {Object.keys(availableLocations).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 font-medium text-center">Kaydedilenlerde uygun ilan (lokasyon) bulunmuyor.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Maksimum Bütçe (TL)</label>
                                    <input
                                        type="text"
                                        value={details.maxPrice ? new Intl.NumberFormat('tr-TR').format(details.maxPrice) : ''}
                                        onChange={e => {
                                            const rawValue = e.target.value.replace(/[^0-9]/g, '');
                                            setDetails({ ...details, maxPrice: rawValue });
                                        }}
                                        className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                        placeholder="Örn: 6.300.000"
                                    />
                                </div>
                                {demandType === 'Konut' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Oda Sayısı (Örn: 3+1)</label>
                                            <input
                                                value={details.rooms || ''}
                                                onChange={e => setDetails({ ...details, rooms: e.target.value })}
                                                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Bulunduğu Kat (Örn: Ara kat, Zemin)</label>
                                            <input
                                                value={details.floorInfo || ''}
                                                onChange={e => setDetails({ ...details, floorInfo: e.target.value })}
                                                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Isıtma</label>
                                            <input
                                                value={details.heating || ''}
                                                onChange={e => setDetails({ ...details, heating: e.target.value })}
                                                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Cephe (Örn: Güney, Kuzey)</label>
                                            <input
                                                value={details.facade || ''}
                                                onChange={e => setDetails({ ...details, facade: e.target.value })}
                                                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                            />
                                        </div>
                                    </>
                                )}
                                {demandType === 'Ticari' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Metrekare (Minimum)</label>
                                            <input
                                                value={details.squareMeters || ''}
                                                onChange={e => setDetails({ ...details, squareMeters: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Kullanım Amacı (Örn: Depo, Ofis)</label>
                                            <input
                                                value={details.commercialType || ''}
                                                onChange={e => setDetails({ ...details, commercialType: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                            />
                                        </div>
                                    </>
                                )}
                                {demandType === 'Arsa' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">İmar Durumu</label>
                                            <input
                                                value={details.zoning || ''}
                                                onChange={e => setDetails({ ...details, zoning: e.target.value })}
                                                placeholder="Müşterinin belirttiği imar türü"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Tapu Durumu</label>
                                            <input
                                                value={details.deedStatus || ''}
                                                onChange={e => setDetails({ ...details, deedStatus: e.target.value })}
                                                placeholder="Örn: Müstakil Parsel, Hisseli"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Ada / Parsel veya Mevki</label>
                                            <input
                                                value={details.plotInfo || ''}
                                                onChange={e => setDetails({ ...details, plotInfo: e.target.value })}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Ek Notlar / Özel İstekler</label>
                                <textarea
                                    rows="3"
                                    value={details.notes || ''}
                                    onChange={e => setDetails({ ...details, notes: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none"
                                    placeholder="Müşterinin özel olarak istediği mahalle, cephe vs."
                                ></textarea>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg border border-indigo-400 hover:bg-indigo-600 transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Kaydediliyor...' : (modalMode === 'create' ? 'Talebi Kaydet' : 'Değişiklikleri Kaydet')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Sliding Panel for Viewing Demands */}
        {showModal && modalMode === 'view' && selectedDemand && (
            <>
                {/* Transparent overlay just to catch outside clicks, no background/blur */}
                <div className="fixed inset-0 z-40" onClick={() => setShowModal(false)}></div>

                {/* Panel - Floating and shadow without touching edges */}
                <div className="fixed top-4 bottom-4 right-4 z-50 w-[calc(100%-2rem)] md:w-[600px] lg:w-[750px] bg-white shadow-2xl rounded-3xl flex flex-col border border-gray-100 animate-in slide-in-from-right duration-300 overflow-hidden">

                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{selectedDemand.clientName}</h3>
                            <p className="text-sm text-gray-500 mt-1">İletişim: {selectedDemand.clientPhone || '-'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={openEditModal}
                                className="px-3 py-2 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors font-bold flex items-center gap-2 border border-transparent hover:border-indigo-100"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Düzenle
                            </button>
                            <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-0 custom-scrollbar bg-white">

                        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <div className="flex gap-2">
                                    <span className={`px-3 py-1 font-bold rounded-lg border shadow-sm ${selectedDemand.transactionType === 'Satılık' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                        {selectedDemand.transactionType}
                                    </span>
                                    <span className="px-3 py-1 font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg shadow-sm">
                                        {selectedDemand.demandType}
                                    </span>
                                </div>
                                <select
                                    value={selectedDemand.status || 'Aktif'}
                                    onChange={(e) => handleUpdateStatus(selectedDemand.id, e.target.value)}
                                    className="text-sm font-bold bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-all hover:bg-gray-50/50"
                                >
                                    <option value="Aktif" className="text-gray-900">Aktif</option>
                                    <option value="Talep için aranacak" className="text-gray-900">Talep için aranacak</option>
                                    <option value="Talep için arandı" className="text-gray-900">Talep için arandı</option>
                                    <option value="İlanlara bakılıyor" className="text-gray-900">İlanlara bakılıyor</option>
                                    <option value="Sunum yapılacak" className="text-gray-900">Sunum yapılacak</option>
                                    <option value="Tamamlandı" className="text-gray-900">Tamamlandı</option>
                                    <option value="İptal" className="text-gray-900">İptal</option>
                                </select>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 gap-y-6">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Maksimum Bütçe</p>
                                    <p className="font-bold text-gray-900 text-lg line-clamp-2">
                                        {selectedDemand.details?.maxPrice ? `${Number(selectedDemand.details.maxPrice).toLocaleString('tr-TR')} TL` : 'Belirtilmedi'}
                                    </p>
                                </div>

                                {/* KONUT DETAILS */}
                                {selectedDemand.demandType === 'Konut' && (
                                    <>
                                        {selectedDemand.details?.rooms && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Oda Sayısı</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.rooms}</p>
                                            </div>
                                        )}
                                        {selectedDemand.details?.floorInfo && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Bulunduğu Kat</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.floorInfo}</p>
                                            </div>
                                        )}
                                        {selectedDemand.details?.heating && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Isıtma</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.heating}</p>
                                            </div>
                                        )}
                                        {selectedDemand.details?.facade && (
                                            <div className="col-span-2">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Cephe</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.facade}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* TICARI DETAILS */}
                                {selectedDemand.demandType === 'Ticari' && (
                                    <>
                                        {selectedDemand.details?.squareMeters && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Metrekare</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.squareMeters}</p>
                                            </div>
                                        )}
                                        {selectedDemand.details?.commercialType && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Kullanım Amacı</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.commercialType}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ARSA DETAILS */}
                                {selectedDemand.demandType === 'Arsa' && (
                                    <>
                                        {selectedDemand.details?.zoning && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">İmar Durumu</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.zoning}</p>
                                            </div>
                                        )}
                                        {selectedDemand.details?.deedStatus && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tapu Durumu</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.deedStatus}</p>
                                            </div>
                                        )}
                                        {selectedDemand.details?.plotInfo && (
                                            <div className="col-span-2">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ada/Parsel/Mevki</p>
                                                <p className="font-medium text-gray-800 line-clamp-2">{selectedDemand.details.plotInfo}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                            </div>
                            {selectedDemand.details?.notes && (
                                <div className="mt-4 p-4 bg-orange-50 text-orange-900 rounded-xl text-sm border border-orange-100 shadow-sm">
                                    <strong className="block mb-1 text-xs uppercase tracking-wider text-orange-600">Ek Notlar / İhtiyaçlar:</strong>
                                    <div className="whitespace-pre-wrap">{selectedDemand.details.notes}</div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50/50 min-h-screen">
                            <div className="flex border-b border-gray-200 mb-6">
                                <button
                                    type="button"
                                    className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'matches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setActiveTab('matches')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    İlişkin İlanlar ({selectedDemand.matchedListings?.length || 0})
                                </button>
                                <button
                                    type="button"
                                    className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors relative ${activeTab === 'suggestions' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setActiveTab('suggestions')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                    Önerilen İlanlar
                                    {suggestions.length > 0 && (
                                        <span className="bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-[10px] ml-1">{suggestions.length}</span>
                                    )}
                                    {suggestions.length > 0 && activeTab !== 'suggestions' && (
                                        <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors relative ${activeTab === 'colleagueMatches' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setActiveTab('colleagueMatches')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    İş Ortağı İlanları
                                    {colleagueMatches.length > 0 && (
                                        <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-[10px] ml-1">{colleagueMatches.length}</span>
                                    )}
                                </button>
                            </div>

                            {activeTab === 'matches' && (
                                (!selectedDemand.matchedListings || selectedDemand.matchedListings.length === 0) ? (
                                    <div className="text-center p-8 bg-white border border-dashed border-gray-200 rounded-2xl">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <p className="text-gray-500 font-medium">Bu talebe henüz onay bekleyenlerden ilan eklenmemiş.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedDemand.matchedListings.map(l => (
                                            <div
                                                key={l.listingId}
                                                onClick={() => {
                                                    setShowModal(false);
                                                    navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: l.listingId } });
                                                }}
                                                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer"
                                            >
                                                <div className="flex justify-between items-start gap-2 mb-2">
                                                    <h5 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors" title={l.title}>{l.title}</h5>
                                                    <div className="flex items-start gap-2">
                                                        {(l.ilanNo || l.sellerName || l.officeName) && (
                                                            <div className="flex flex-col items-end shrink-0 gap-1 text-[10px]">
                                                                {l.ilanNo && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold border border-gray-200">#{l.ilanNo}</span>}
                                                                {l.sellerName && <span className="text-gray-500 font-medium truncate max-w-[100px]" title={l.sellerName}>{l.sellerName}</span>}
                                                                {l.officeName ? (
                                                                    <span className="text-gray-400 font-medium italic flex items-center gap-1 truncate max-w-[100px]" title={l.officeName}>
                                                                        {l.officeLogo && <img src={l.officeLogo} alt="" className="w-3 h-3 object-contain opacity-70" />}
                                                                        {l.officeName}
                                                                    </span>
                                                                ) : l.isOffice && (
                                                                    <span className="text-indigo-300 font-medium italic flex items-center gap-1">
                                                                        Emlak Ofisinden
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleRemoveMatch(e, selectedDemand.id, l.listingId)}
                                                            className="text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 p-1.5 rounded-md border border-gray-100 transition-colors"
                                                            title="Talepten Çıkar"
                                                            disabled={removingMatchId === l.listingId}
                                                        >
                                                            {removingMatchId === l.listingId ? (
                                                                <svg className="w-3.5 h-3.5 animate-spin text-red-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                            ) : (
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-3 bg-gray-50 w-fit px-2 py-1 rounded-md border border-gray-100">
                                                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    {l.neighborhood || (l.city && l.district ? `${l.city}, ${l.district}` : 'Konum Belirtilmemiş')}
                                                </div>

                                                <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-50">
                                                    <span className="font-black text-indigo-700 text-base bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{l.price}</span>
                                                    <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        {new Date(l.dateAdded).toLocaleDateString('tr-TR')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {activeTab === 'suggestions' && (
                                loadingSuggestions ? (
                                    <div className="flex flex-col items-center justify-center p-12 bg-white border border-dashed border-gray-200 rounded-2xl">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-4"></div>
                                        <p className="text-gray-500 font-medium animate-pulse">Platformdaki uygun ilanlar taranıyor...</p>
                                    </div>
                                ) : suggestions.length === 0 ? (
                                    <div className="text-center p-8 bg-white border border-dashed border-gray-200 rounded-2xl">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-300">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                        </div>
                                        <h4 className="text-gray-900 font-bold mb-1">Eşleşen İlan Bulunamadı</h4>
                                        <p className="text-gray-500 text-sm">Bu kriterlere uygun bir ilan sistemde henüz mevcut değil veya tüm uygun ilanlar zaten eşleşmiş.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {suggestions.map((l, index) => (
                                            <div
                                                key={l.listingId}
                                                className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 flex flex-col sm:flex-row gap-5 relative group"
                                            >
                                                {/* Left: Image */}
                                                <div className="w-full sm:w-48 h-48 sm:h-auto shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 relative cursor-pointer" onClick={() => { setShowModal(false); navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: l.listingId } }); }}>
                                                    {l.images && l.images[0] ? (
                                                        <img src={l.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                            <span className="text-[10px] uppercase font-bold tracking-wider">RESİM YOK</span>
                                                        </div>
                                                    )}
                                                    {index === 0 && (
                                                        <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black tracking-wider px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1 z-10">
                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-1.245-1.118-1.895zm-2.096 11.516a1 1 0 01-.132 1.411 1 1 0 01-1.278-.13c-.015-.015-.029-.03-.042-.045l-.039-.047-.042-.054-.055-.078a6.529 6.529 0 01-.267-.44c-.114-.216-.27-.552-.416-.94-.287-.775-.434-1.614-.14-2.483.08-.24.184-.442.288-.616a2.645 2.645 0 01.196-.289l.023-.028.012-.014.004-.004h.001A.996.996 0 0110.5 10c.046 0 .092.003.136.01.276.037.64.12 1.05.32 1.077.525 2.052 1.55 2.052 3.67 0 1.258-.456 2.378-1.218 3.25l-.264.296a1 1 0 01-1.472-1.346c.55-.615.954-1.45.954-2.5 0-1.217-.506-1.838-1.04-2.098a3.918 3.918 0 00-.7-.272c-.171.211-.322.457-.457.734-.236.48-.363.984-.363 1.42 0 .421.134.821.363 1.25z" clipRule="evenodd"></path></svg>
                                                            EN İYİ EŞLEŞME
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Middle: Content */}
                                                <div className="flex-1 flex flex-col min-w-0">
                                                    {/* Header (Badges + Price) */}
                                                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                                        <div className="flex flex-wrap gap-2">
                                                            <span className="bg-amber-50 ring-1 ring-inset ring-amber-500/30 text-amber-700 text-[11px] font-extrabold px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                                                                🔥 %{Math.min(100, l.score)} Uyum {l.score >= 80 ? '🎯' : ''}
                                                            </span>
                                                            <span className={`px-2 py-1 rounded text-[11px] font-bold ring-1 ring-inset shadow-sm ${l.status === 'archived' ? 'bg-gray-50 text-gray-500 ring-gray-500/20' : 'bg-blue-50 text-blue-600 ring-blue-500/20'}`}>
                                                                {l.status === 'archived' ? 'Arşivde' : (l.status === 'approved' ? 'Kaydedilenlerde' : 'Onay Bekliyor')}
                                                            </span>
                                                        </div>
                                                        <span className="font-black text-indigo-700 bg-indigo-50 ring-1 ring-inset ring-indigo-500/20 px-2 py-1 rounded-md shrink-0 text-sm shadow-sm">
                                                            {l.price}
                                                        </span>
                                                    </div>

                                                    {/* Title */}
                                                    <h5
                                                        className="font-bold text-gray-900 text-base leading-snug mb-2 cursor-pointer hover:text-indigo-600 transition-colors line-clamp-2 pr-4"
                                                        title={l.title}
                                                        onClick={() => { setShowModal(false); navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: l.listingId } }); }}
                                                    >
                                                        {l.title}
                                                    </h5>

                                                    {/* Location & ID */}
                                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4">
                                                        <span className="flex items-center gap-1">
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                            {l.location?.split('/')[2]?.trim() || l.location?.split('/').slice(0, 2).join(', ') || 'Konum Belirtilmemiş'}
                                                        </span>
                                                        <span className="text-gray-300">&bull;</span>
                                                        {(l.ilanNo) && <span className="font-medium">#{l.ilanNo}</span>}
                                                    </div>

                                                    {/* Bottom Area: Match Details + Button */}
                                                    <div className="mt-auto flex flex-col xl:flex-row items-stretch xl:items-end justify-between gap-4 pt-4 border-t border-gray-100">

                                                        {/* Visualized Score Breakdown */}
                                                        {l.matchDetails && l.matchDetails.length > 0 && (
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Eşleşme Kriterleri</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {l.matchDetails.map((d, i) => (
                                                                        <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs shadow-sm">
                                                                            <span className="text-green-600 font-extrabold">+{d.pts || 0}</span>
                                                                            <span className="text-gray-600 font-medium">{d.text || (typeof d === 'string' ? d : '')}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Action Button */}
                                                        <div className="shrink-0 w-full xl:w-auto mt-2 xl:mt-0">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleMatchSuggestion(e, l)}
                                                                disabled={matchingSuggestionId === l.listingId}
                                                                className="w-full xl:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                                            >
                                                                {matchingSuggestionId === l.listingId ? (
                                                                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                                                )}
                                                                Talebe Ekle
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {activeTab === 'colleagueMatches' && (
                                loadingColleagueMatches ? (
                                    <div className="flex flex-col items-center justify-center p-12 bg-white border border-dashed border-gray-200 rounded-2xl">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                                        <p className="text-gray-500 font-medium animate-pulse">İş ortaklarının ilanları taranıyor...</p>
                                    </div>
                                ) : colleagueMatches.length === 0 ? (
                                    <div className="text-center p-8 bg-white border border-dashed border-gray-200 rounded-2xl">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-300">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        </div>
                                        <h4 className="text-gray-900 font-bold mb-1">Eşleşen İş Ortağı İlanı Yok</h4>
                                        <p className="text-gray-500 text-sm">Diğer danışmanların portföyünde bu talebe uygun bir ilan bulunamadı.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {colleagueMatches.map(l => (
                                            <div
                                                key={l.id}
                                                className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md hover:border-blue-300 flex flex-col sm:flex-row gap-5 relative group"
                                            >
                                                <div className="w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 relative">
                                                    {l.imageUrl || l.image ? (
                                                        <img src={l.imageUrl || l.image} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                        <div className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm border border-blue-500">
                                                            İŞ ORTAĞI
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 flex flex-col min-w-0">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h5 className="font-bold text-gray-900 text-sm line-clamp-1">{l.title}</h5>
                                                        <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-100 whitespace-nowrap">{l.price}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3">
                                                        <span className="flex items-center gap-1 font-bold text-gray-600 italic">
                                                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white">{(l.displayName || l.username || '?')[0].toUpperCase()}</div>
                                                            {l.displayName || l.username}
                                                        </span>
                                                        <span>&bull;</span>
                                                        <span className="truncate">{l.location}</span>
                                                    </div>
                                                    <div className="mt-auto flex items-center justify-between gap-4 pt-3 border-t border-gray-50">
                                                        <div className="flex gap-2">
                                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{l.mainCategory}</span>
                                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{l.subCategory}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setChatDemandId(selectedDemand.id);
                                                                setChatReceiverId(l.userId);
                                                                setChatReceiverName(l.displayName || l.username);
                                                                setChatListingId(l.id);
                                                                setChatListingTitle(l.title);
                                                                setShowChat(true);
                                                                fetchConversation(selectedDemand.id, l.userId);
                                                            }}
                                                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black py-1.5 px-3 rounded shadow-sm transition-all active:scale-95"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                            İLETİŞİME GEÇ
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>

                    </div>
                </div>
            </>
        )}

        {/* Demand Share Modal */}
        <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            users={users}
            onShare={handleShareDemand}
            demandId={sharingDemandId}
        />
        {/* In-App Chat Overlay */}
        {showChat && (
            <div className="fixed bottom-6 right-6 z-[60] w-full max-w-sm animate-in slide-in-from-right-10 duration-300">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col h-[500px] overflow-hidden">
                    <div className="p-4 bg-blue-600 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
                                {chatReceiverName?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm leading-none mb-1">{chatReceiverName}</h4>
                                <p className="text-[10px] text-blue-100 opacity-80">Danışman İletişimi</p>
                            </div>
                        </div>
                        <button onClick={() => setShowChat(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-50/50">
                        {loadingMessages ? (
                            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>
                        ) : chatMessages.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-gray-400 text-xs italic">Henüz mesaj yok. İlk mesajı siz gönderin!</p>
                            </div>
                        ) : (
                            chatMessages.map(m => (
                                <div key={m.id} className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] flex flex-col ${m.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                                        <div className={`p-3 rounded-2xl text-xs shadow-sm ${m.senderId === user?.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none font-medium'}`}>
                                            {m.listingTitle && (
                                                <div className={`mb-1.5 p-1.5 rounded-lg text-[9px] border flex flex-col gap-0.5 ${m.senderId === user?.id ? 'bg-white/10 border-white/20 text-blue-100' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                                                    <span className="font-black uppercase tracking-tighter opacity-70">İlan Referansı</span>
                                                    <Link to="/sayfalar/kaydedilenler" state={{ expandRecordId: m.listingId }} className="font-bold truncate hover:underline">
                                                        {m.listingTitle}
                                                    </Link>
                                                </div>
                                            )}
                                            {m.text}
                                        </div>
                                        <span className="text-[9px] text-gray-400 mt-1 px-1 font-bold">
                                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 shrink-0">
                        {chatListingTitle && (
                            <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
                                <div className="flex-1 min-w-0">
                                    <span className="block text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-70 mb-0.5">Alıntılanan İlan</span>
                                    <p className="text-xs font-bold text-blue-900 truncate">{chatListingTitle}</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => { setChatListingId(null); setChatListingTitle(null); }}
                                    className="p-1.5 text-blue-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                value={newMessageText}
                                onChange={e => setNewMessageText(e.target.value)}
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder="Mesajınızı yazın..."
                            />
                            <button type="submit" className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-500/20">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
    );
}

function ShareModal({ isOpen, onClose, users, onShare, demandId }) {
    const [shareType, setShareType] = useState('public'); // 'public', 'direct'
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-900">Talebi Paylaş</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-100 rounded-2xl">
                        <button
                            onClick={() => setShareType('public')}
                            className={`py-3 text-sm font-bold rounded-xl transition-all ${shareType === 'public' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Tüm Danışmanlar
                        </button>
                        <button
                            onClick={() => setShareType('direct')}
                            className={`py-3 text-sm font-bold rounded-xl transition-all ${shareType === 'direct' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Doğrudan Paylaş
                        </button>
                    </div>

                    {shareType === 'direct' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Danışman Seçin</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {users.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${selectedUserIds.includes(u.id) ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedUserIds.includes(u.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 bg-white'}`}>
                                            {selectedUserIds.includes(u.id) && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: u.userColor || '#3b82f6' }}>
                                            {(u.displayName || u.username)[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900 leading-none">{u.displayName || u.username}</p>
                                            <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-tighter">İş Ortağı</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            onClick={() => onShare(demandId, shareType, shareType === 'direct' ? selectedUserIds : [])}
                            disabled={shareType === 'direct' && selectedUserIds.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:scale-100"
                        >
                            PAYLAŞIMI {shareType === 'public' ? 'TÜMÜNE AÇ' : 'GÖNDER'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Demands;
