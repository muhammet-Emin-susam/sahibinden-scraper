import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Demands() {
    const { token } = useContext(AuthContext);
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
    const [details, setDetails] = useState({});

    useEffect(() => {
        fetchDemands();
    }, []);

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
                    details
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
                if (selectedDemand?.id === demandId) {
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

    const openCreateModal = () => {
        setFormData({ clientName: '', clientPhone: '' });
        setDemandType('Konut');
        setTransactionType('Satılık');
        setDetails({});
        setModalMode('create');
        setShowModal(true);
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
                                    <button
                                        onClick={(e) => handleDelete(demand.id, e)}
                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-lg"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
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

            {/* Create Modal */}
            {showModal && modalMode === 'create' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl relative z-10 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900">Yeni Müşteri Talebi</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateDemand} className="overflow-y-auto flex-1 p-6 custom-scrollbar">
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
                                        onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                                        className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                        placeholder="0555..."
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
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Maksimum Bütçe (TL)</label>
                                        <input
                                            type="number"
                                            value={details.maxPrice || ''}
                                            onChange={e => setDetails({ ...details, maxPrice: e.target.value })}
                                            className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
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
                                    {saving ? 'Oluşturuluyor...' : 'Talebi Kaydet'}
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
                    <div className="fixed top-4 bottom-4 right-4 z-50 w-full md:w-[450px] bg-white shadow-2xl rounded-3xl flex flex-col border border-gray-100 animate-in slide-in-from-right duration-300 overflow-hidden">

                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedDemand.clientName}</h3>
                                <p className="text-sm text-gray-500 mt-1">İletişim: {selectedDemand.clientPhone || '-'}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
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
                                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    İlişkin İlanlar ({selectedDemand.matchedListings?.length || 0})
                                </h4>

                                {(!selectedDemand.matchedListings || selectedDemand.matchedListings.length === 0) ? (
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
                                                    {l.city && l.district ? `${l.district}, ${l.city}` : (l.neighborhood ? `${l.neighborhood}` : 'Konum Belirtilmemiş')}
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
                                )}
                            </div>

                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default Demands;
