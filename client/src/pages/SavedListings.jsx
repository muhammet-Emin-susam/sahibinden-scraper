import React, { useState, useEffect, useContext } from 'react';
import * as XLSX from 'xlsx-js-style';
import { AuthContext } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

function SavedListings() {
    const [savedRecords, setSavedRecords] = useState([]);
    const [expandedRecordId, setExpandedRecordId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [activityLogs, setActivityLogs] = useState({}); // { [recordId]: [...logs] }

    // Export Modal states
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState('portfoy');

    // Editing states
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editNoteValue, setEditNoteValue] = useState("");
    const [editingStatusId, setEditingStatusId] = useState(null);
    const [editStatusValue, setEditStatusValue] = useState("");

    const { token, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const fetchRecords = async () => {
        if (!token) return;
        try {
            const response = await fetch('/api/records', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (result.success) {
                // Sadece approved (onaylanmış) kayıtları göster (pending veya deleted olanları gizle)
                const approvedRecords = result.data.filter(r => r.status === 'approved');
                setSavedRecords(approvedRecords);
            } else if (response.status === 401 || response.status === 403) {
                logout();
                navigate('/login');
            }
        } catch (err) {
            console.error('Failed to fetch records:', err);
        }
    };

    useEffect(() => {
        fetchRecords();
        const interval = setInterval(fetchRecords, 5000);
        return () => clearInterval(interval);
    }, [token]);

    const handleDeleteRecord = async (e, id) => {
        e.stopPropagation();

        try {
            await fetch(`/api/records/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setSavedRecords(prev => prev.filter(record => record.id !== id));
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const handleUpdateRecord = async (e, id, type) => {
        e.stopPropagation();
        const isNote = type === 'note';
        const value = isNote ? editNoteValue : editStatusValue;

        try {
            const bodyData = isNote ? { note: value } : { status_tag: value };

            const response = await fetch(`/api/records/${id}/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bodyData)
            });

            const result = await response.json();
            if (result.success) {
                // Update local state
                setSavedRecords(prev => prev.map(record =>
                    record.id === id
                        ? { ...record, [isNote ? 'note' : 'status_tag']: value }
                        : record
                ));

                // Exit edit mode
                if (isNote) {
                    setEditingNoteId(null);
                } else {
                    setEditingStatusId(null);
                }
            }
        } catch (err) {
            console.error('Failed to update:', err);
        }
    };

    const toggleExpand = async (id) => {
        const newId = expandedRecordId === id ? null : id;
        setExpandedRecordId(newId);
        // Fetch activity when opening
        if (newId && !activityLogs[newId]) {
            try {
                const res = await fetch(`/api/records/${newId}/activity`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setActivityLogs(prev => ({ ...prev, [newId]: data.data }));
            } catch (_) { /* ignore */ }
        }
    };

    const [selectedNeighborhood, setSelectedNeighborhood] = useState('Tümü');
    const [selectedUser, setSelectedUser] = useState(user?.role === 'admin' ? '' : 'Tümü');
    const [selectedMainCategory, setSelectedMainCategory] = useState('Tümü');
    const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');

    const mainCategories = ['Tümü', 'Satılık', 'Kiralık', 'Günlük Kiralık', 'Devren Satılık', 'Devren Kiralık', 'Kat Karşılığı', 'Diğer'];
    const subCategories = ['Tümü', 'Konut', 'İş Yeri', 'Arsa', 'Tarla', 'Bahçe', 'Bağ', 'Zeytinlik', 'Bina', 'Devre Mülk', 'Turistik Tesis', 'Diğer'];

    const neighborhoods = ['Tümü', ...new Set(savedRecords.map(r => {
        if (!r.location) return 'Diğer';
        const parts = r.location.split('/');
        return parts.length >= 3 ? parts[2].trim() : 'Diğer';
    }))].sort();

    // Extract unique user objects for the filter dropdown
    const uniqueUsers = [...new Map(savedRecords.map(r => [
        r.username || 'Bilinmiyor',
        { username: r.username || 'Bilinmiyor', displayName: r.displayName || r.username || 'Bilinmiyor' }
    ])).values()].sort((a, b) => a.displayName.localeCompare(b.displayName));

    const filteredRecords = savedRecords.filter(r => {
        const nMatch = selectedNeighborhood === 'Tümü' ||
            (selectedNeighborhood === 'Diğer' && !r.location) ||
            (r.location && r.location.split('/').length >= 3 && r.location.split('/')[2].trim() === selectedNeighborhood);

        let uMatch = true;
        if (user?.role === 'admin') {
            if (selectedUser === '') uMatch = false;
            else if (selectedUser !== 'Tümü') uMatch = (r.username || 'Bilinmiyor') === selectedUser;
        } else {
            uMatch = selectedUser === 'Tümü' || (r.username || 'Bilinmiyor') === selectedUser;
        }

        const mMatch = selectedMainCategory === 'Tümü' || r.mainCategory === selectedMainCategory;
        const sMatch = selectedSubCategory === 'Tümü' || r.subCategory === selectedSubCategory;

        return nMatch && uMatch && mMatch && sMatch;
    });

    const getExcelDataPreview = () => {
        if (filteredRecords.length === 0) return [];
        let dataToExport = filteredRecords;
        let excelData = [];

        if (exportType === 'arsa') {
            dataToExport = filteredRecords.filter(r => r.subCategory === 'Arsa');
            if (dataToExport.length === 0) return null; // Indicator for no data
            excelData = dataToExport.map(record => {
                const props = record.properties || {};
                const ada = props['Ada No'] || props['Ada'] || '-';
                const parsel = props['Parsel No'] || props['Parsel'] || '-';
                const adaParsel = (ada === '-' && parsel === '-') ? '-' : `${ada} - ${parsel}`;
                let mahalle = '-';
                if (record.location) {
                    const parts = record.location.split('/');
                    if (parts.length >= 3) mahalle = parts[2].trim();
                    else if (parts.length > 0) mahalle = parts[parts.length - 1].trim();
                }
                return {
                    'İlan No': props['İlan No'] || '',
                    'Tarih': new Date(record.scrapedAt).toLocaleDateString('tr-TR'),
                    'İsim': record.sellerName || '-',
                    'Telefon Numarası': record.sellerPhone || '-',
                    'Ada - Parsel': adaParsel,
                    'Metrekare': props['m²'] || props['Metrekare'] || '-',
                    'Fiyat': record.price || '-',
                    'Metrekare fiyatı': props['m² Fiyatı'] || '-',
                    'Mahalle': mahalle,
                    'Tapu durumu': props['Tapu Durumu'] || '-',
                    'İnşaat Alanı': props['İnşaat Alanı'] || '-',
                    'Danışman İsmi': record.displayName || record.username || 'Bilinmiyor'
                };
            });
        } else {
            excelData = filteredRecords.map(record => {
                const props = record.properties || {};

                let sehir = '-';
                let ilce = '-';
                let mahalle = '-';
                if (record.location) {
                    const parts = record.location.split('/').map(p => p.trim());
                    if (parts.length >= 1) sehir = parts[0];
                    if (parts.length >= 2) ilce = parts[1];
                    if (parts.length >= 3) mahalle = parts[2];
                }

                // Clean price for easier math if needed later, but retaining original string here since it's a preview
                return {
                    'İlan No': props['İlan No'] || '',
                    'Tarih': new Date(record.scrapedAt).toLocaleDateString('tr-TR'),
                    'Durum': record.status_tag || '',
                    'Tür': record.subCategory || '',
                    'Şehir': sehir,
                    'İlçe': ilce,
                    'Mahalle': mahalle,
                    'Adres': record.location || '',
                    'M²': props['m² (Brüt)'] || props['m² (Net)'] || props['m²'] || props['Metrekare'] || '',
                    'Oda Sayısı': props['Oda Sayısı'] || '',
                    'Kat': props['Bulunduğu Kat'] || '',
                    'Bina Yaşı': props['Bina Yaşı'] || '',
                    'Isınma': props['Isıtma'] || '',
                    'Asansör': '',
                    'Otopark': '',
                    'İlan Fiyatı': record.price || '',
                    'Piyasa Fiyatı': '',
                    'Fark %': '',
                    'M² Fiyatı': props['m² Fiyatı'] || '',
                    'Mal Sahibi': record.sellerName || '',
                    'Telefon': record.sellerPhone || '',
                    'E-posta': '',
                    'Satış Nedeni': '',
                    'Aciliyet': '',
                    'Tapu Durumu': props['Tapu Durumu'] || '',
                    'Kredi Uygun': props['Krediye Uygunluk'] || '',
                    'Aidat': props['Aidat (TL)'] || '',
                    'Notlar': record.note || '',
                    'İlan m² Fiyat': props['m² Fiyatı'] || '',
                    'Piyasa Ort m²': '',
                    'Fark % ': '', // Note extra space to differentiate from the first 'Fark %' key
                    'Değerlendirme': '',
                    'Fırsat Skoru': ''
                };
            });
        }
        return excelData;
    };

    const handleExportExcel = () => {
        const excelData = getExcelDataPreview();

        if (!excelData) {
            alert('Filtrelenmiş ilanlar arasında "Arsa" tipinde kayıt bulunamadı.');
            return;
        }
        if (excelData.length === 0) return;

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        let durumColIndex = -1;
        for (let c = range.s.c; c <= range.e.c; ++c) {
            const addr = XLSX.utils.encode_cell({ r: 0, c: c });
            if (worksheet[addr] && worksheet[addr].v === 'Durum') {
                durumColIndex = c;
                break;
            }
        }

        if (durumColIndex !== -1) {
            for (let r = 1; r <= range.e.r; ++r) {
                const durumAddr = XLSX.utils.encode_cell({ r: r, c: durumColIndex });
                const durumCell = worksheet[durumAddr];
                if (durumCell && durumCell.v) {
                    let color = null;
                    switch (durumCell.v) {
                        case "Aranacak": color = "FFFFFFE0"; break; // Soft Yellow
                        case "Arandı": color = "FFE0FFE0"; break; // Soft Green
                        case "Ulaşılamadı": color = "FFFFE0E0"; break; // Soft Red
                        case "İlgilenmiyor": color = "FFFFEAC0"; break; // Soft Orange
                        case "Randevu Alındı": color = "FFE0E0FF"; break; // Soft Blue
                        case "Satıldı": color = "FFD3D3D3"; break; // Gray
                        case "İptal": color = "FFE8E8E8"; break; // Light Gray
                    }
                    if (color) {
                        for (let c = range.s.c; c <= range.e.c; ++c) {
                            const rowAddr = XLSX.utils.encode_cell({ r: r, c: c });
                            if (!worksheet[rowAddr]) worksheet[rowAddr] = { t: 's', v: '' }; // Create empty cell if absent
                            // Preserve existing styles if any, and add fill
                            worksheet[rowAddr].s = { ...worksheet[rowAddr].s, fill: { fgColor: { rgb: color } } };
                        }
                    }
                }
            }
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, exportType === 'arsa' ? "Arsa Listesi" : "Portföy Listesi");
        const fileName = exportType === 'arsa' ? `arsa_listesi_${new Date().toISOString().slice(0, 10)}.xlsx` : `portfoy_listesi_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        setShowExportModal(false);
    };

    const previewData = showExportModal ? getExcelDataPreview() : [];
    const previewColumns = previewData && previewData.length > 0 ? Object.keys(previewData[0]) : [];

    return (
        <div className="font-sans animate-fade-in">
            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[80] bg-white flex items-center justify-center p-0 animate-fade-in">
                    <div className="bg-white w-full h-full p-6 animate-fade-in-up flex flex-col">
                        <div className="flex justify-between items-center mb-5 flex-shrink-0">
                            <h3 className="text-xl font-bold text-gray-900">Excel Dışa Aktar</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="mb-6 flex-shrink-0">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Şablon Tipi Seçin:</label>
                            <div className="grid grid-cols-2 gap-3 max-w-md">
                                <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${exportType === 'portfoy' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 hover:border-green-200 hover:bg-gray-50'}`}>
                                    <input type="radio" name="exportType" value="portfoy" checked={exportType === 'portfoy'} onChange={(e) => setExportType(e.target.value)} className="hidden" />
                                    <svg className={`w-8 h-8 ${exportType === 'portfoy' ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    <span className={`font-semibold text-sm ${exportType === 'portfoy' ? 'text-green-800' : 'text-gray-600'}`}>Portföy Listesi</span>
                                    <span className="text-[10px] text-center text-gray-500">Tüm sütunlarla eksiksiz liste</span>
                                </label>

                                <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${exportType === 'arsa' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 hover:border-green-200 hover:bg-gray-50'}`}>
                                    <input type="radio" name="exportType" value="arsa" checked={exportType === 'arsa'} onChange={(e) => setExportType(e.target.value)} className="hidden" />
                                    <svg className={`w-8 h-8 ${exportType === 'arsa' ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <span className={`font-semibold text-sm ${exportType === 'arsa' ? 'text-green-800' : 'text-gray-600'}`}>Arsa Listesi</span>
                                    <span className="text-[10px] text-center text-gray-500">Sadece arsalar ve arsa sütunları</span>
                                </label>
                            </div>
                        </div>

                        {/* Preview Section */}
                        <div className="flex-grow flex flex-col min-h-0 mb-6 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="bg-gray-100 border-b border-gray-200 p-3 flex justify-between items-center text-sm font-semibold text-gray-600 flex-shrink-0">
                                <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    Önizleme (İlk 5 Kayıt)
                                </span>
                                {previewData ? (
                                    <span className="text-xs font-normal text-gray-500">Toplam {previewData.length} kayıt indirilecek</span>
                                ) : null}
                            </div>

                            <div className="overflow-auto custom-scrollbar flex-grow p-0">
                                {!previewData ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-gray-400 h-full">
                                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        <p>Seçilen filtrelerde "Arsa" tipinde ilan bulunamadı.</p>
                                    </div>
                                ) : previewData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-gray-400 h-full">
                                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                        <p>İndirilecek kayıt yok.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse whitespace-nowrap">
                                        <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                                            <tr>
                                                {previewColumns.map((col, i) => (
                                                    <th key={i} className="p-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {previewData.slice(0, 5).map((row, i) => (
                                                <tr key={i} className="hover:bg-green-50/30">
                                                    {previewColumns.map((col, j) => (
                                                        <td key={j} className="p-3 text-sm text-gray-600 max-w-[200px] truncate" title={row[col]}>
                                                            {row[col]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end flex-shrink-0">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleExportExcel}
                                disabled={!previewData || previewData.length === 0}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Excel'i İndir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black/95 flex p-4 animate-fade-in overflow-auto custom-scrollbar"
                    onClick={() => {
                        setLightboxImage(null);
                        setIsZoomed(false);
                    }}
                >
                    <div className="m-auto min-h-full min-w-full flex items-center justify-center">
                        <img
                            src={lightboxImage}
                            className={`transition-all duration-300 rounded-lg shadow-2xl ${isZoomed
                                ? 'w-[150vw] max-w-none cursor-zoom-out'
                                : 'max-w-full max-h-[90vh] object-contain cursor-zoom-in'
                                }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsZoomed(!isZoomed);
                            }}
                            alt="Full size"
                        />
                    </div>
                    <button
                        className="fixed top-6 right-6 text-white hover:text-gray-300 bg-black/50 hover:bg-black/80 p-2 rounded-full transition-colors z-[70]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(null);
                            setIsZoomed(false);
                        }}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    {!isZoomed && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-white/70 bg-black/50 px-4 py-2 rounded-full text-sm pointer-events-none flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                            Yakınlaştırmak için resme tıklayın
                        </div>
                    )}
                </div>
            )}

            <div className="animate-fade-in-up pb-10">
                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                        Kaydedilen İlanlar <span className="text-gray-500">({filteredRecords.length})</span>
                    </h2>
                    <div className="flex gap-3">
                        <button
                            onClick={fetchRecords}
                            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            Yenile
                        </button>
                        <button
                            onClick={() => setShowExportModal(true)}
                            disabled={savedRecords.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Excel Olarak İndir
                        </button>
                    </div>
                </div>

                {user?.role === 'admin' && (
                    <div className="bg-white rounded-2xl p-5 mb-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Yönetici Paneli Filtresi</h3>
                                <p className="text-sm text-gray-500">Görüntülemek istediğiniz kullanıcının ilanlarını seçin.</p>
                            </div>
                        </div>
                        <select
                            className="bg-gray-50 border-2 border-gray-200 text-gray-900 text-lg font-bold rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block w-full md:w-80 p-3 outline-none cursor-pointer transition-all hover:bg-gray-100"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                        >
                            <option value="" disabled>Kullanıcı Seçiniz</option>
                            <option value="Tümü">Tümünü Göster</option>
                            {uniqueUsers.map((u, i) => (
                                <option key={i} value={u.username}>{u.displayName} İlanları</option>
                            ))}
                        </select>
                    </div>
                )}

                {user?.role === 'admin' && selectedUser === '' ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-16 text-center animate-fade-in-up">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-100">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Kullanıcı Seçimi Bekleniyor</h3>
                        <p className="text-gray-500 max-w-md mx-auto text-lg font-medium">
                            İlan listesini görüntülemek için lütfen yukarıdaki menüden bir kullanıcı seçin.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-4 mb-6">
                            {/* Connected Category Dropdowns */}
                            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">İşlem:</label>
                                    <select
                                        value={selectedMainCategory}
                                        onChange={(e) => setSelectedMainCategory(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-lg focus:ring-2 focus:ring-blue-500/50 block p-2 outline-none cursor-pointer transition-all hover:bg-gray-100"
                                    >
                                        {mainCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>

                                <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kategori:</label>
                                    <select
                                        value={selectedSubCategory}
                                        onChange={(e) => setSelectedSubCategory(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-lg focus:ring-2 focus:ring-blue-500/50 block p-2 outline-none cursor-pointer transition-all hover:bg-gray-100"
                                    >
                                        {subCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Neighborhood Filter Tabs */}
                            {neighborhoods.length > 2 && (
                                <div className="overflow-x-auto pb-2 flex-grow scrollbar-hide">
                                    <div className="flex space-x-2">
                                        {neighborhoods.map(mahalle => (
                                            <button
                                                key={mahalle}
                                                onClick={() => setSelectedNeighborhood(mahalle)}
                                                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${selectedNeighborhood === mahalle
                                                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                    }`}
                                            >
                                                {mahalle}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-bold tracking-widest">
                                            <th className="p-4 w-24 text-center">GÖRSEL</th>
                                            <th className="p-4">BAŞLIK</th>
                                            <th className="p-4">KATEGORİ</th>
                                            <th className="p-4">FİYAT</th>
                                            <th className="p-4">KONUM</th>
                                            <th className="p-4">DURUM</th>
                                            {user?.role === 'admin' && <th className="p-4">EKLEYEN</th>}
                                            <th className="p-4">TARİH</th>
                                            <th className="p-4 w-24 text-right">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredRecords.map((record) => (
                                            <React.Fragment key={record.id}>
                                                <tr
                                                    onClick={() => toggleExpand(record.id)}
                                                    className={`cursor-pointer transition-colors group ${expandedRecordId === record.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="p-4 text-center">
                                                        {record.images && record.images[0] ? (
                                                            <img src={record.images[0]} alt="" className="w-16 h-12 object-cover rounded-md shadow-sm border border-gray-200 mx-auto" />
                                                        ) : (
                                                            <div className="w-16 h-12 bg-gray-100 rounded-md border border-gray-200 mx-auto flex items-center justify-center text-xs font-bold text-gray-400">Yok</div>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-semibold text-gray-900 line-clamp-2">{record.title}</div>
                                                        {record.properties && record.properties['İlan No'] && (
                                                            <div className="text-xs text-gray-500 mt-1">#{record.properties['İlan No']}</div>
                                                        )}
                                                        {(record.sellerName || record.sellerPhone) && (
                                                            <div className="text-[11px] text-gray-500 mt-1.5 space-y-0.5 bg-gray-50 p-1.5 rounded border border-gray-100 w-max pr-4">
                                                                {record.sellerName && <div className="flex items-center gap-1.5"><svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {record.sellerName}</div>}
                                                                {record.sellerPhone && <div className="flex items-center gap-1.5"><svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {record.sellerPhone}</div>}
                                                            </div>
                                                        )}
                                                        <a href={record.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] font-semibold text-blue-500 hover:underline mt-1.5 block flex items-center gap-1">
                                                            İlana Git
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                        </a>
                                                    </td>
                                                    <td className="p-4 whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            {record.mainCategory && (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${record.mainCategory === 'Satılık' ? 'bg-indigo-100 text-indigo-700' :
                                                                    record.mainCategory === 'Kiralık' ? 'bg-orange-100 text-orange-700' :
                                                                        record.mainCategory === 'Günlük Kiralık' ? 'bg-purple-100 text-purple-700' :
                                                                            record.mainCategory.includes('Devren') ? 'bg-amber-100 text-amber-700' :
                                                                                record.mainCategory === 'Kat Karşılığı' ? 'bg-emerald-100 text-emerald-700' :
                                                                                    'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {record.mainCategory}
                                                                </span>
                                                            )}
                                                            {record.subCategory && (
                                                                <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-500 text-[10px] font-medium border border-gray-100 w-fit">
                                                                    {record.subCategory}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 font-bold text-indigo-600 whitespace-nowrap">
                                                        {record.price}
                                                    </td>
                                                    <td className="p-4 text-gray-600 text-sm">
                                                        {record.location}
                                                    </td>
                                                    <td className="p-4 text-gray-800 text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                                        {editingStatusId === record.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <select
                                                                    className="border border-orange-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:border-orange-500"
                                                                    value={editStatusValue}
                                                                    onChange={(e) => setEditStatusValue(e.target.value)}
                                                                    autoFocus
                                                                >
                                                                    <option value="">Seçiniz</option>
                                                                    <option value="Aranacak">Aranacak</option>
                                                                    <option value="Arandı">Arandı</option>
                                                                    <option value="Ulaşılamadı">Ulaşılamadı</option>
                                                                    <option value="İlgilenmiyor">İlgilenmiyor</option>
                                                                    <option value="Randevu Alındı">Randevu Alındı</option>
                                                                    <option value="Satıldı">Satıldı</option>
                                                                    <option value="İptal">İptal</option>
                                                                </select>
                                                                <button onClick={(e) => handleUpdateRecord(e, record.id, 'status')} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                                </button>
                                                                <button onClick={() => setEditingStatusId(null)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 group/status">
                                                                {record.status_tag ? (
                                                                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs">{record.status_tag}</span>
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs">-</span>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingStatusId(record.id);
                                                                        setEditStatusValue(record.status_tag || "");
                                                                    }}
                                                                    className="text-gray-400 hover:text-blue-500 opacity-0 group-hover/status:opacity-100 transition-opacity"
                                                                    title="Durumu Düzenle"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {user?.role === 'admin' && (
                                                        <td className="p-4 text-gray-800 text-sm font-medium">
                                                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs whitespace-nowrap inline-block">{record.displayName || record.username || 'Bilinmiyor'}</span>
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                                                        {new Date(record.scrapedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                        <br />
                                                        {new Date(record.scrapedAt).toLocaleDateString('tr-TR')}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={(e) => handleDeleteRecord(e, record.id)}
                                                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                            title="Sil"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                        </button>
                                                        <button className="text-gray-400 ml-2">
                                                            <svg className={`w-5 h-5 transform transition-transform ${expandedRecordId === record.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expandedRecordId === record.id && (
                                                    <tr className="bg-gray-50/50 animate-fade-in relative z-10 w-full">
                                                        <td colSpan={user?.role === 'admin' ? "9" : "8"} className="p-0 border-b border-gray-100" style={{ maxWidth: 0 }}>
                                                            <div className="p-6 w-full mx-auto">
                                                                <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg group/note relative">
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <h4 className="text-sm font-bold text-yellow-800">Onay Notu</h4>
                                                                        {editingNoteId !== record.id && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingNoteId(record.id);
                                                                                    setEditNoteValue(record.note || "");
                                                                                }}
                                                                                className="text-yellow-600 hover:text-yellow-800 opacity-0 group-hover/note:opacity-100 transition-opacity p-1 bg-yellow-100 rounded"
                                                                                title="Notu Düzenle"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {editingNoteId === record.id ? (
                                                                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                                                            <textarea
                                                                                className="w-full bg-white border border-yellow-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                                                                rows="3"
                                                                                value={editNoteValue}
                                                                                onChange={(e) => setEditNoteValue(e.target.value)}
                                                                                autoFocus
                                                                            />
                                                                            <div className="flex gap-2 mt-2 justify-end">
                                                                                <button
                                                                                    onClick={() => setEditingNoteId(null)}
                                                                                    className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                                                                                >
                                                                                    İptal
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => handleUpdateRecord(e, record.id, 'note')}
                                                                                    className="text-xs text-white bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded flex items-center gap-1"
                                                                                >
                                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                                                    Kaydet
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-sm text-yellow-700 whitespace-pre-wrap">{record.note || <span className="text-yellow-600/50 italic">Not girilmemiş. Eklemek için düzenle ikonuna tıklayın.</span>}</p>
                                                                    )}
                                                                </div>
                                                                {record.images && record.images.length > 0 && (
                                                                    <div className="mb-8 relative group max-w-full">
                                                                        <div className="flex items-center justify-between mb-3 ml-1">
                                                                            <h4 className="font-semibold text-gray-900">Görseller ({record.images.length})</h4>
                                                                            <span className="text-xs text-gray-500 mr-2 md:hidden">(Kaydırılabilir)</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const container = e.currentTarget.parentElement.querySelector('.overflow-x-auto');
                                                                                if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                                                                            }}
                                                                            className="absolute left-0 top-1/2 z-20 bg-white shadow-lg border border-gray-100 text-gray-700 p-2 rounded-full hover:bg-gray-50 hover:scale-110 transition-all duration-200 -translate-y-1/2 -ml-3 md:ml-0"
                                                                            title="Sola Kaydır"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                                                        </button>
                                                                        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1 snap-x scroll-smooth no-scrollbar" style={{ scrollBehavior: 'smooth' }}>
                                                                            {record.images.map((img, idx) => (
                                                                                <div
                                                                                    key={idx}
                                                                                    className="flex-none w-64 h-48 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden cursor-zoom-in snap-center hover:shadow-md transition-shadow relative group/img"
                                                                                    onClick={() => setLightboxImage(img)}
                                                                                >
                                                                                    <img src={img} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" loading="lazy" />
                                                                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors pointer-events-none" />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const container = e.currentTarget.parentElement.querySelector('.overflow-x-auto');
                                                                                if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                                                                            }}
                                                                            className="absolute right-0 top-1/2 z-20 bg-white shadow-lg border border-gray-100 text-gray-700 p-2 rounded-full hover:bg-gray-50 hover:scale-110 transition-all duration-200 -translate-y-1/2 -mr-3 md:mr-0"
                                                                            title="Sağa Kaydır"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <div className="grid md:grid-cols-2 gap-8 max-w-full">
                                                                    <div>
                                                                        <h4 className="font-semibold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
                                                                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                                                            Özellikler
                                                                        </h4>
                                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                                                            {record.properties && Object.entries(record.properties).map(([key, value]) => (
                                                                                <div key={key} className="flex flex-col border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                                                                    <span className="text-gray-500 text-xs mb-1 uppercase tracking-wide">{key}</span>
                                                                                    <span className="font-medium text-gray-800 break-words">{value}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
                                                                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                                                                            Açıklama Özeti
                                                                        </h4>
                                                                        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm h-full max-w-full overflow-hidden">
                                                                            <div
                                                                                className="text-sm text-gray-600 leading-relaxed max-h-[400px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar break-words"
                                                                                dangerouslySetInnerHTML={{ __html: record.description }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Activity Timeline */}
                                                                {(() => {
                                                                    const logs = activityLogs[record.id];
                                                                    const actionLabel = (a) => ({
                                                                        listing_added: { icon: '➕', text: 'İlan eklendi', color: 'text-green-600 bg-green-50 border-green-200' },
                                                                        listing_deleted: { icon: '🗑️', text: 'İlan silindi', color: 'text-red-600 bg-red-50 border-red-200' },
                                                                        status_changed: { icon: '🔄', text: 'Durum değişti', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                                                                        status_tag_changed: { icon: '🏷️', text: 'Etiket değişti', color: 'text-purple-600 bg-purple-50 border-purple-200' },
                                                                        note_changed: { icon: '📝', text: 'Not güncellendi', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                                                                    }[a] || { icon: '•', text: a, color: 'text-gray-600 bg-gray-50 border-gray-200' });

                                                                    return logs && logs.length > 0 ? (
                                                                        <div className="mt-6 pt-6 border-t border-gray-100">
                                                                            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                                Aktivite Geçmişi
                                                                            </h4>
                                                                            <div className="relative pl-5 space-y-3">
                                                                                <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200" />
                                                                                {logs.map((log) => {
                                                                                    const { icon, text, color } = actionLabel(log.action);
                                                                                    return (
                                                                                        <div key={log.id} className="relative flex gap-3 items-start">
                                                                                            <div className="absolute -left-3.5 top-1 w-3 h-3 rounded-full bg-white border-2 border-gray-300" />
                                                                                            <div className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
                                                                                                {icon} {text}
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-xs font-semibold text-gray-700">{log.by}</p>
                                                                                                {log.from !== null && log.to !== null && log.from !== log.to && (
                                                                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                                                                        <span className="line-through">{log.from || '(boş)'}</span>
                                                                                                        {' → '}
                                                                                                        <span className="font-medium text-gray-600">{log.to || '(boş)'}</span>
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                            <span className="ml-auto text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                                                                                                {new Date(log.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                                                                {' '}
                                                                                                {new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                                                            </span>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ) : logs ? (
                                                                        <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400 text-center">Henüz aktivite yok.</div>
                                                                    ) : null;
                                                                })()}

                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {savedRecords.length === 0 && (
                                <div className="p-16 text-center">
                                    <div className="text-gray-300 mb-4">
                                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    </div>
                                    <h3 className="text-xl font-medium text-gray-900 mb-2">Listeniz Boş</h3>
                                    <p className="text-gray-500 max-w-md mx-auto">
                                        Sahibinden.com'da gezmek için eklentiyi yükleyin ve ilanlardaki
                                        <span className="inline-block bg-blue-600 text-white text-xs px-2 py-1 rounded-full mx-1">Listeye Ekle</span>
                                        butonuna basın. Eklediklerinizi burada görebilirsiniz.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default SavedListings;
