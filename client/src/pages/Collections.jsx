import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx-js-style';

const Collections = () => {
    const { token, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [collections, setCollections] = useState([]);
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recordsLoading, setRecordsLoading] = useState(false);

    // Collection management states
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // UI states
    const [expandedRecordId, setExpandedRecordId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCollections();
    }, []);

    useEffect(() => {
        if (selectedCollectionId) {
            fetchCollectionRecords(selectedCollectionId);
        } else {
            setRecords([]);
        }
    }, [selectedCollectionId]);

    const fetchCollections = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/collections', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setCollections(data.data);
                if (data.data.length > 0 && !selectedCollectionId) {
                    setSelectedCollectionId(data.data[0].id);
                }
            }
        } catch (err) {
            console.error("Error fetching collections:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCollectionRecords = async (collectionId) => {
        try {
            setRecordsLoading(true);
            // We'll fetch all records and filter by collectionId for now, 
            // or we could update the backend to support ?collectionId=...
            const res = await fetch('/api/records', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const filtered = data.data.filter(r =>
                    r.collections && r.collections.includes(collectionId) && r.status !== 'deleted'
                );
                setRecords(filtered);
            }
        } catch (err) {
            console.error("Error fetching collection records:", err);
        } finally {
            setRecordsLoading(false);
        }
    };

    const handleRenameCollection = async () => {
        if (!newName.trim()) return;
        try {
            const res = await fetch(`/api/collections/${selectedCollectionId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });
            const data = await res.json();
            if (data.success) {
                setCollections(collections.map(c => c.id === selectedCollectionId ? { ...c, name: newName } : c));
                setIsRenaming(false);
            }
        } catch (err) {
            console.error("Error renaming collection:", err);
        }
    };

    const handleDeleteCollection = async () => {
        if (!window.confirm("Bu koleksiyonu silmek istediğinize emin misiniz? İlanlar silinmeyecek, sadece bu gruptan çıkarılacaktır.")) return;
        try {
            setIsDeleting(true);
            const res = await fetch(`/api/collections/${selectedCollectionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const updatedCollections = collections.filter(c => c.id !== selectedCollectionId);
                setCollections(updatedCollections);
                if (updatedCollections.length > 0) {
                    setSelectedCollectionId(updatedCollections[0].id);
                } else {
                    setSelectedCollectionId(null);
                }
            }
        } catch (err) {
            console.error("Error deleting collection:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRemoveRecordFromCollection = async (recordId) => {
        const record = records.find(r => r.id === recordId);
        if (!record) return;

        const updatedCollections = record.collections.filter(cId => cId !== selectedCollectionId);

        try {
            const res = await fetch(`/api/records/${recordId}/collections`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ collectionIds: updatedCollections })
            });
            const data = await res.json();
            if (data.success) {
                setRecords(records.filter(r => r.id !== recordId));
            }
        } catch (err) {
            console.error("Error removing record from collection:", err);
        }
    };

    const exportToExcel = () => {
        const currentCollection = collections.find(c => c.id === selectedCollectionId);
        const fileName = `${currentCollection?.name || 'Koleksiyon'}_Listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`;

        const exportData = records.map(record => ({
            'Başlık': record.title,
            'Fiyat': record.price,
            'Konum': record.location,
            'İşlem Tipi': record.mainCategory || '',
            'Kategori': record.subCategory || '',
            'Durum': record.status_tag || '',
            'İlan No': record.properties?.['İlan No'] || '',
            'Satıcı': record.sellerName || '',
            'Telefon': record.sellerPhone || '',
            'Emlak Ofisi': record.officeName || '',
            'Not': record.note || '',
            'URL': record.url,
            'Google Haritalar': record.googleMapsUrl || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "İlanlar");

        // Styling
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_col(C) + "1";
            if (!ws[address]) continue;
            ws[address].s = {
                fill: { fgColor: { rgb: "4F46E5" } },
                font: { color: { rgb: "FFFFFF" }, bold: true },
                alignment: { horizontal: "center" }
            };
        }

        XLSX.writeFile(wb, fileName);
    };

    const filteredRecords = records.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.properties?.['İlan No'] && r.properties['İlan No'].includes(searchTerm))
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Side: Collections List */}
                <div className="w-full md:w-72 flex-shrink-0">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden sticky top-0">
                        <div className="p-5 border-b border-gray-50 bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                Koleksiyonlarım
                            </h3>
                        </div>
                        <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-2 custom-scrollbar">
                            {collections.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 text-sm italic">
                                    Henüz koleksiyon oluşturmadınız.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {collections.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setSelectedCollectionId(c.id); setIsRenaming(false); }}
                                            className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between group ${selectedCollectionId === c.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <span className="font-semibold truncate">{c.name}</span>
                                            <svg className={`w-4 h-4 transition-transform ${selectedCollectionId === c.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:opacity-50 group-hover:translate-x-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Collection Content */}
                <div className="flex-1 min-w-0">
                    {!selectedCollectionId ? (
                        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center h-[500px] flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Başlamak için Bir Koleksiyon Seçin</h3>
                            <p className="text-gray-500 max-w-sm">Sol menüden bir koleksiyon seçerek içindeki ilanları yönetebilirsiniz.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Collection Header */}
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {isRenaming ? (
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    className="bg-gray-50 border border-indigo-200 text-gray-900 text-2xl font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 w-full max-w-md"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameCollection()}
                                                />
                                                <button onClick={handleRenameCollection} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-sm transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></button>
                                                <button onClick={() => setIsRenaming(false)} className="text-gray-400 hover:text-gray-600 p-3 bg-gray-100 rounded-xl transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 group">
                                                <h2 className="text-3xl font-black text-gray-900 truncate">
                                                    {collections.find(c => c.id === selectedCollectionId)?.name}
                                                    <span className="text-indigo-600/50 ml-3 text-xl font-bold">({records.length})</span>
                                                </h2>
                                                <button
                                                    onClick={() => {
                                                        setIsRenaming(true);
                                                        setNewName(collections.find(c => c.id === selectedCollectionId)?.name || '');
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                </button>
                                            </div>
                                        )}
                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <div className="relative flex-1 max-w-xs">
                                                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                <input
                                                    type="text"
                                                    placeholder="Koleksiyon içinde ara..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={exportToExcel}
                                            disabled={records.length === 0}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-green-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                            Excel'e Aktar
                                        </button>
                                        <button
                                            onClick={handleDeleteCollection}
                                            className="bg-red-50 text-red-600 p-3 rounded-2xl hover:bg-red-100 transition-all"
                                            title="Koleksiyonu Sil"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Records Table */}
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                {recordsLoading ? (
                                    <div className="p-12 text-center">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                                        <p className="mt-4 text-gray-500 font-medium">İlanlar yükleniyor...</p>
                                    </div>
                                ) : filteredRecords.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900 mb-1">Burada ilan bulunamadı</h4>
                                        <p className="text-gray-500">Koleksiyona ilan eklemek için "Kaydedilenler" veya "Arşiv" sayfasındaki yıldız butonunu kullanabilirsiniz.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] uppercase text-gray-400 font-black tracking-widest">
                                                    <th className="p-4 w-20 text-center">GÖRSEL</th>
                                                    <th className="p-4">İLAN BİLGİSİ</th>
                                                    <th className="p-4">FİYAT / KONUM</th>
                                                    <th className="p-4 w-24 text-right">İŞLEMLER</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {filteredRecords.map((record, index) => (
                                                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group relative">
                                                        <td className="p-4 align-top relative">
                                                            {/* Row Number Outside - Centered Vertically */}
                                                            <div className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 flex items-center pr-4 pointer-events-none select-none">
                                                                <span className="text-[16px] font-black text-gray-400 opacity-0 group-hover:opacity-100 lg:opacity-50 transition-opacity">
                                                                    {index + 1}
                                                                </span>
                                                            </div>
                                                            {record.images && record.images[0] ? (
                                                                <img src={record.images[0]} className="w-16 h-16 object-cover rounded-xl shadow-sm border border-gray-100" />
                                                            ) : (
                                                                <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase">Resim Yok</div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-1">
                                                                <button
                                                                    onClick={() => navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: record.id } })}
                                                                    className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight text-left"
                                                                >
                                                                    {record.title}
                                                                </button>
                                                                <div className="flex flex-wrap gap-2 mt-1">
                                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${record.mainCategory === 'Satılık' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                                                                        {record.mainCategory}
                                                                    </span>
                                                                    {record.properties?.['İlan No'] && (
                                                                        <span className="text-[10px] font-bold text-gray-400 tracking-wider">#{record.properties['İlan No']}</span>
                                                                    )}
                                                                </div>
                                                                {record.note && (
                                                                    <div className="mt-2 text-xs text-gray-500 bg-amber-50/50 p-2 rounded-lg border border-amber-100 border-dashed line-clamp-2 italic">
                                                                        "{record.note}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-lg font-black text-indigo-700">{record.price}</div>
                                                                <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                                    {record.location}
                                                                </div>
                                                                {record.status_tag && (
                                                                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                                                                        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100">
                                                                            {record.status_tag}
                                                                        </span>
                                                                        {record.officeName && (
                                                                            <span className="text-[10px] text-gray-400 font-medium italic truncate max-w-[150px]" title={record.officeName}>
                                                                                {record.officeName}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right align-top">
                                                            <div className="flex flex-col items-end gap-2">
                                                                <button
                                                                    onClick={() => handleRemoveRecordFromCollection(record.id)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                                    title="Koleksiyondan Çıkar"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: record.id } })}
                                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                                    title="İlan Detayına Git"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Collections;
