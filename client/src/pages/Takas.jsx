import React, { useState, useEffect, useContext } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const PROPERTY_TYPES = ['Konut', 'Arsa', 'Arazi', 'Araba', 'Dükkan', 'Yazlık', 'Diğer'];

function Takas() {
    const { showToast, showAlert, showConfirm } = useNotification();
    const [trades, setTrades] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRequestsModal, setShowRequestsModal] = useState(null);
    const [selectedTradeId, setSelectedTradeId] = useState(null);
    const [matches, setMatches] = useState([]);
    const [isMatchesLoading, setIsMatchesLoading] = useState(false);

    // Filter states
    const [filterOffered, setFilterOffered] = useState('');
    const [filterRequested, setFilterRequested] = useState('');

    const { token, user } = useContext(AuthContext);

    const fetchTrades = async () => {
        if (!token) return;
        try {
            let url = `${API_BASE_URL}/trades?`;
            if (filterOffered) url += `offeredType=${filterOffered}&`;
            if (filterRequested) url += `requestedType=${filterRequested}&`;

            const response = await fetch(url.slice(0, -1), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setTrades(result.data);
                if (result.data.length > 0 && !selectedTradeId) {
                    setSelectedTradeId(result.data[0].id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch trades:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMatches = async (id) => {
        if (!token || !id) return;
        setIsMatchesLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/trades/${id}/matches`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setMatches(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch matches:', err);
        } finally {
            setIsMatchesLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
    }, [token, filterOffered, filterRequested]);

    useEffect(() => {
        if (selectedTradeId) {
            fetchMatches(selectedTradeId);
        }
    }, [selectedTradeId, token]);

    const handleDeleteTrade = async (id) => {
        if (!(await showConfirm('Takas Talebini Sil', 'Bu takas talebini silmek istediğinize emin misiniz?'))) return;
        try {
            const response = await fetch(`${API_BASE_URL}/trades/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setTrades(prev => prev.filter(t => t.id !== id));
                if (selectedTradeId === id) setSelectedTradeId(null);
                showToast('Takas talebi silindi.', 'success');
            }
        } catch (err) {
            console.error('Failed to delete trade:', err);
            showAlert('Hata', 'Silme işlemi başarısız oldu.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium tracking-tight">Takas Akışı Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-100 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Takas Akışı
                    </h1>
                    <p className="text-sm text-gray-400 mt-1 font-medium">Danışmanlar arası yapılandırılmış takas talepleri.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    Yeni Takas Talebi
                </button>
            </header>

            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-8 flex flex-wrap items-center gap-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Filtrele:</span>
                <select
                    value={filterOffered}
                    onChange={(e) => setFilterOffered(e.target.value)}
                    className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-600 outline-none focus:border-blue-300"
                >
                    <option value="">Verilen: Tümü</option>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                    value={filterRequested}
                    onChange={(e) => setFilterRequested(e.target.value)}
                    className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-600 outline-none focus:border-blue-300"
                >
                    <option value="">İstenen: Tümü</option>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(filterOffered || filterRequested) && (
                    <button onClick={() => { setFilterOffered(''); setFilterRequested(''); }} className="text-xs text-red-500 font-bold hover:underline">Temizle</button>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {trades.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Eşleşen Talep Yok</h3>
                            <p className="text-sm text-gray-500">Seçili filtrelere göre takas bulunamadı.</p>
                        </div>
                    ) : (
                        trades.map((trade) => (
                            <TradeCard
                                key={trade.id}
                                trade={trade}
                                isSelected={selectedTradeId === trade.id}
                                onSelect={() => setSelectedTradeId(trade.id)}
                                onDelete={() => handleDeleteTrade(trade.id)}
                                onShowRequests={() => setShowRequestsModal(trade)}
                                currentUser={user}
                                token={token}
                            />
                        ))
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-4">
                        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"> Akıllı Eşleşmeler </h2>
                        <div className="space-y-4">
                            {isMatchesLoading ? (
                                [1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse"></div>)
                            ) : matches.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-sm italic">Uygun portföy öğesi bulunamadı.</div>
                            ) : (
                                matches.map((match) => {
                                    const matchScorePercent = Math.min(Math.round((match.matchScore / 110) * 100), 100);
                                    let scoreColor = 'bg-blue-50 text-blue-600 border-blue-100';
                                    if (matchScorePercent > 80) scoreColor = 'bg-green-50 text-green-600 border-green-100';
                                    if (matchScorePercent < 50) scoreColor = 'bg-gray-50 text-gray-500 border-gray-100';

                                    return (
                                        <Link key={match.id} to="/sayfalar/kaydedilenler" state={{ expandRecordId: match.id }} className="flex gap-4 p-3 rounded-xl border border-transparent hover:border-blue-100 hover:bg-blue-50 transition-all group relative">
                                            <div className="absolute -top-1 -right-1 z-10">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${scoreColor}`}>
                                                    %{matchScorePercent}
                                                </span>
                                            </div>
                                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                                <img src={match.images?.[0] || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">{match.category}</p>
                                                <p className="text-xs font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors uppercase">{match.title}</p>
                                                <p className="text-blue-600 font-bold text-sm mt-1">{match.price}</p>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showCreateModal && <CreateTradeModal onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchTrades(); showToast('Takas talebi paylaşıldı.', 'success'); }} showAlert={showAlert} token={token} />}
            {showRequestsModal && <MatchRequestsModal trade={showRequestsModal} onClose={() => setShowRequestsModal(null)} onUpdate={() => fetchTrades()} showToast={showToast} showAlert={showAlert} token={token} />}
        </div>
    );
}

function TradeCard({ trade, isSelected, onSelect, onDelete, onShowRequests, currentUser, token }) {
    const isOwner = currentUser?.id === trade.userId || currentUser?.role === 'admin';
    const [isRequesting, setIsRequesting] = useState(false);
    const [hasRequested, setHasRequested] = useState(false);

    const handleRequestMatch = async (e) => {
        e.stopPropagation();
        if (hasRequested) return;
        setIsRequesting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/trades/${trade.id}/match-request`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if ((await response.json()).success) setHasRequested(true);
        } catch (err) { console.error(err); } finally { setIsRequesting(false); }
    };

    const renderSpecs = (data) => {
        if (!data || Object.keys(data).length === 0) return null;
        const labels = {
            rooms: 'Oda Sayısı', floor: 'Bulunduğu Kat', sqm: 'Net Alan', year: 'Yıl', km: 'Kilometre',
            zoning: 'İmar Durumu', parcel: 'Ada / Parsel', heating: 'Isınma', model: 'Model/Seri',
            series: 'Seri', fuel: 'Yakıt Tipi', gearbox: 'Vites', age: 'Bina Yaşı',
            bathrooms: 'Banyo Sayısı', totalFloor: 'Toplam Kat', damage: 'Tramer/Hasar', region: 'Konum / Bölge'
        };

        const priority = ['rooms', 'sqm', 'age', 'km', 'region', 'zoning', 'model', 'parcel'];
        const entries = Object.entries(data)
            .filter(([_, value]) => value && value !== '')
            .sort(([a], [b]) => {
                const idxA = priority.indexOf(a);
                const idxB = priority.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
            });

        if (entries.length === 0) return null;

        return (
            <div className="grid grid-cols-2 gap-2 mt-4">
                {entries.map(([key, value]) => (
                    <div key={key} className="flex flex-col bg-white/50 p-2 rounded-xl border border-white/50 shadow-sm backdrop-blur-sm">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mb-0.5">{labels[key] || key}</span>
                        <span className="text-[11px] font-black text-slate-800 uppercase truncate leading-tight">{value}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div
            onClick={onSelect}
            className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 cursor-pointer relative ${isSelected ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-100" style={{ backgroundColor: trade.userColor || '#3b82f6' }}>
                        {trade.userName?.[0].toUpperCase()}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">{trade.userName}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(trade.createdAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isOwner && (
                        <button onClick={(e) => { e.stopPropagation(); onShowRequests(); }} className="bg-white text-gray-900 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"> Talepler </button>
                    )}
                    {isOwner && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-100 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 relative mb-4">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center">
                    <div className="w-10 h-10 bg-white rounded-full border border-gray-100 flex items-center justify-center text-blue-600 shadow-xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </div>
                </div>

                <div className="bg-blue-50/40 rounded-2xl p-5 border border-blue-100/50 flex flex-col h-full">
                    <div className="flex-1">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-1">VERİLECEK</span>
                        <h5 className="text-xl font-black text-blue-900 leading-tight">{trade.offeredType}</h5>
                        {renderSpecs(trade.offeredData)}
                    </div>
                    {trade.offeredDetails && (
                        <div className="mt-4 pt-4 border-t border-blue-100/50">
                            <span className="text-[8px] font-bold text-blue-300 uppercase tracking-widest block mb-1">Notlar</span>
                            <p className="text-xs text-blue-900/70 font-bold leading-relaxed italic break-all overflow-hidden bg-white/30 p-2 rounded-lg border border-blue-50">"{trade.offeredDetails}"</p>
                        </div>
                    )}
                </div>

                <div className="bg-amber-50/40 rounded-2xl p-5 border border-amber-100/50 flex flex-col h-full">
                    <div className="flex-1">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">İSTENEN</span>
                        <h5 className="text-xl font-black text-amber-900 leading-tight">{trade.requestedType}</h5>
                        {renderSpecs(trade.requestedData)}
                    </div>
                    {trade.requestedDetails && (
                        <div className="mt-4 pt-4 border-t border-amber-100/50">
                            <span className="text-[8px] font-bold text-amber-300 uppercase tracking-widest block mb-1">Notlar</span>
                            <p className="text-xs text-amber-900/70 font-bold leading-relaxed italic break-all overflow-hidden bg-white/30 p-2 rounded-lg border border-amber-50">"{trade.requestedDetails}"</p>
                        </div>
                    )}
                </div>
            </div>

            {trade.matchedWith && trade.matchedWith.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md uppercase border border-green-100"> Eşleşmeler </span>
                    {trade.matchedWith.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-green-50 shadow-sm">
                            <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-black" style={{ backgroundColor: m.userColor || '#10b981' }}>{m.userName?.[0].toUpperCase()}</div>
                            <span className="text-[10px] font-bold text-gray-700">{m.userName}</span>
                        </div>
                    ))}
                </div>
            )}

            {!isOwner && (
                <div className="mt-4 flex justify-end">
                    <button onClick={handleRequestMatch} disabled={isRequesting || hasRequested} className={`font-bold py-2 px-6 rounded-lg transition-all text-xs flex items-center gap-2 uppercase tracking-tighter ${hasRequested ? 'bg-green-100 text-green-600 cursor-default shadow-none' : 'bg-gray-900 text-white hover:bg-blue-600 shadow-sm'}`}>
                        {hasRequested ? 'TALEP GÖNDERİLDİ' : isRequesting ? 'GÖNDERİLİYOR...' : 'EŞLEŞME TALEBİ GÖNDER'}
                    </button>
                </div>
            )}
        </div>
    );
}

function CreateTradeModal({ onClose, onCreated, token }) {
    const [offeredType, setOfferedType] = useState('Konut');
    const [offeredDetails, setOfferedDetails] = useState('');
    const [offeredData, setOfferedData] = useState({});

    const [requestedType, setRequestedType] = useState('Arsa');
    const [requestedDetails, setRequestedDetails] = useState('');
    const [requestedData, setRequestedData] = useState({});

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDataChange = (isOffered, key, value) => {
        if (isOffered) setOfferedData(prev => ({ ...prev, [key]: value }));
        else setRequestedData(prev => ({ ...prev, [key]: value }));
    };

    const inputClass = "w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-bold text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-50 transition-all placeholder:text-gray-300 placeholder:font-medium";
    const labelClass = "text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5";

    const renderDetailedFields = (type, isOffered) => {
        const data = isOffered ? offeredData : requestedData;

        if (type === 'Konut') {
            return (
                <div className="grid grid-cols-2 gap-3 mt-4 animate-in fade-in duration-300">
                    <div className="col-span-2">
                        <label className={labelClass}>Bölge (İlçe/Semt)</label>
                        <input type="text" placeholder="Örn: Çankaya, Ayrancı" value={data.region || ''} onChange={e => handleDataChange(isOffered, 'region', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Oda Sayısı</label>
                        <select value={data.rooms || ''} onChange={e => handleDataChange(isOffered, 'rooms', e.target.value)} className={inputClass} required>
                            <option value="">Seçiniz</option>
                            {['1+1', '2+1', '3+1', '4+1', '4+2', '5+1', 'Diğer'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>m2 (Net)</label>
                        <input type="text" placeholder="m2" value={data.sqm || ''} onChange={e => handleDataChange(isOffered, 'sqm', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Bulunduğu Kat</label>
                        <input type="text" placeholder="Kat" value={data.floor || ''} onChange={e => handleDataChange(isOffered, 'floor', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Bina Yaşı</label>
                        <select value={data.age || ''} onChange={e => handleDataChange(isOffered, 'age', e.target.value)} className={inputClass} required>
                            <option value="">Seçiniz</option>
                            {['0', '1-5', '5-10', '10-20', '20+'].map(y => <option key={y} value={y}>{y} Yıl</option>)}
                        </select>
                    </div>
                </div>
            );
        }
        if (type === 'Arsa' || type === 'Arazi') {
            return (
                <div className="grid grid-cols-2 gap-3 mt-4 animate-in fade-in duration-300">
                    <div className="col-span-2">
                        <label className={labelClass}>Bölge (İl/İlçe/Mahalle)</label>
                        <input type="text" placeholder="Örn: Gölbaşı, İncek" value={data.region || ''} onChange={e => handleDataChange(isOffered, 'region', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Ada / Parsel</label>
                        <input type="text" placeholder="000/00" value={data.parcel || ''} onChange={e => handleDataChange(isOffered, 'parcel', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>m2</label>
                        <input type="text" placeholder="Örn: 500" value={data.sqm || ''} onChange={e => handleDataChange(isOffered, 'sqm', e.target.value)} className={inputClass} required />
                    </div>
                    <div className="col-span-2">
                        <label className={labelClass}>İmar Durumu</label>
                        <select value={data.zoning || ''} onChange={e => handleDataChange(isOffered, 'zoning', e.target.value)} className={inputClass} required>
                            <option value="">Seçiniz</option>
                            {['Konut İmarlı', 'Ticari İmarlı', 'Sanayi İmarlı', 'Bağ/Bahçe', 'Tarla', 'Diğer'].map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    </div>
                </div>
            );
        }
        if (type === 'Araba') {
            return (
                <div className="grid grid-cols-2 gap-3 mt-4 animate-in fade-in duration-300">
                    <div className="col-span-2">
                        <label className={labelClass}>Marka / Seri / Model</label>
                        <input type="text" placeholder="Örn: BMW 3 Serisi 320d" value={data.model || ''} onChange={e => handleDataChange(isOffered, 'model', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Yıl</label>
                        <input type="text" placeholder="Örn: 2022" value={data.year || ''} onChange={e => handleDataChange(isOffered, 'year', e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                        <label className={labelClass}>Yakıt</label>
                        <select value={data.fuel || ''} onChange={e => handleDataChange(isOffered, 'fuel', e.target.value)} className={inputClass} required>
                            <option value="">Seçiniz</option>
                            {['Dizel', 'Benzin', 'Elektrik', 'Hibrit'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                </div>
            );
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/trades`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ offeredType, offeredDetails, offeredData, requestedType, requestedDetails, requestedData })
            });
            if ((await resp.json()).success) onCreated();
        } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200">
                <header className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Yeni Takas Talebi</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Lütfen detayları eksiksiz doldurunuz.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
                    <div className="p-8 space-y-8 flex-1">
                        <div className="grid md:grid-cols-2 gap-10">
                            {/* Offered Side */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 border-l-4 border-blue-500 pl-3">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Sizden Gidecek Varlık</h4>
                                </div>
                                <div className="space-y-4">
                                    <select value={offeredType} onChange={(e) => { setOfferedType(e.target.value); setOfferedData({}); }} className={inputClass}>
                                        {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {renderDetailedFields(offeredType, true)}
                                    <div className="mt-4">
                                        <label className={labelClass}>Ekstra Notlar</label>
                                        <textarea value={offeredDetails} onChange={(e) => setOfferedDetails(e.target.value)} placeholder="Mülkün özel bir durumu, artıları veya ek notlar..." className={inputClass + " h-24 resize-none"} required />
                                    </div>
                                </div>
                            </section>

                            {/* Requested Side */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 border-l-4 border-amber-500 pl-3">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Karşılığında İstenen</h4>
                                </div>
                                <div className="space-y-4">
                                    <select value={requestedType} onChange={(e) => { setRequestedType(e.target.value); setRequestedData({}); }} className={inputClass}>
                                        {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {renderDetailedFields(requestedType, false)}
                                    <div className="mt-4">
                                        <label className={labelClass}>Ekstra Notlar</label>
                                        <textarea value={requestedDetails} onChange={(e) => setRequestedDetails(e.target.value)} placeholder="Aradığınız bölge, bütçe üstüne nakit beklentisi vb..." className={inputClass + " h-24 resize-none"} required />
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    <footer className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 bg-white border border-gray-200 text-gray-500 font-bold py-3 rounded-xl hover:bg-gray-50 transition-all uppercase tracking-tighter text-xs">İptal</button>
                        <button type="submit" disabled={isSubmitting} className="flex-[2] bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all uppercase tracking-tighter text-xs">
                            {isSubmitting ? 'Paylaşılıyor...' : 'Yeni Takas Talebini Akışta Paylaş'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}

function MatchRequestsModal({ trade, onClose, onUpdate, token }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/trades/${trade.id}/match-requests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (data.success) setRequests(data.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchRequests(); }, [trade.id]);

    const handleAction = async (requestId, action) => {
        try {
            const resp = await fetch(`${API_BASE_URL}/match-requests/${requestId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action })
            });
            if ((await resp.json()).success) { 
                fetchRequests(); 
                onUpdate(); 
                showToast(action === 'approve' ? 'Talep onaylandı.' : 'Talep reddedildi.');
            } else {
                showAlert('Hata', 'İşlem gerçekleştirilemedi.');
            }
        } catch (err) { 
            console.error(err); 
            showAlert('Hata', 'Sunucu hatası.');
        }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-gray-900/30 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-xl border border-gray-100 animate-in zoom-in-95 duration-200">
                <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 text-sm tracking-tight uppercase">Gelen Talepler</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-red-500 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="p-4 overflow-y-auto max-h-[50vh] space-y-3 bg-white">
                    {loading ? <div className="text-center py-8">...</div> : requests.length === 0 ? <div className="py-12 text-center opacity-40 text-[10px] font-bold uppercase tracking-widest">Henüz bir talep bulunmuyor</div> :
                        requests.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-sm" style={{ backgroundColor: req.senderColor || '#3b82f6' }}>{req.senderName?.[0].toUpperCase()}</div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 truncate uppercase tracking-tighter">{req.senderName}</p>
                                        <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${req.status === 'pending' ? 'text-amber-500' : req.status === 'approved' ? 'text-green-500' : 'text-red-400'}`}> {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'} </p>
                                    </div>
                                </div>
                                {req.status === 'pending' && <div className="flex gap-1.5"><button onClick={() => handleAction(req.id, 'approve')} className="bg-blue-600 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg">ONAY</button><button onClick={() => handleAction(req.id, 'reject')} className="bg-white border border-red-50 text-red-500 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg">RED</button></div>}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

export default Takas;
