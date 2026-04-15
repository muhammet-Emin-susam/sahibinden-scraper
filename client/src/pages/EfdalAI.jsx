import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config';


function EfdalAI() {
    const { token, user } = useContext(AuthContext);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzingId, setAnalyzingId] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [cooldown, setCooldown] = useState(0);
    const [activeTab, setActiveTab] = useState('analiz'); // 'analiz' or 'parsel'

    // Initialize cooldown from localStorage
    useEffect(() => {
        const savedEndTime = localStorage.getItem('efdalai_cooldown_end');
        if (savedEndTime) {
            const remaining = Math.ceil((parseInt(savedEndTime) - Date.now()) / 1000);
            if (remaining > 0) {
                setCooldown(remaining);
            } else {
                localStorage.removeItem('efdalai_cooldown_end');
            }
        }
    }, []);

    // Countdown effect for cooldown
    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        localStorage.removeItem('efdalai_cooldown_end');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    // TKGM States
    const [tkgmLoading, setTkgmLoading] = useState(false);
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [neighborhoods, setNeighborhoods] = useState([]);
    const [selectedProv, setSelectedProv] = useState('');
    const [selectedDist, setSelectedDist] = useState('');
    const [selectedNeig, setSelectedNeig] = useState('');
    const [provName, setProvName] = useState('Konya'); // Forced to Konya
    const [distNameText, setDistNameText] = useState('');
    const [neighNameText, setNeighNameText] = useState('');
    const [ada, setAda] = useState('');
    const [parsel, setParsel] = useState('');
    const [parcelResult, setParcelResult] = useState(null);
    const [analyzingParcel, setAnalyzingParcel] = useState(false);
    const [parcelAnalysis, setParcelAnalysis] = useState(null);
    const [searchingParcel, setSearchingParcel] = useState(false);
    const [showListingPicker, setShowListingPicker] = useState(false);
    const [listingSearch, setListingSearch] = useState('');

    const fetchRecords = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/records`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                // Show both approved and pending listings for consultant evaluation
                const relevantRecords = data.data.filter(r => r.status === 'approved' || r.status === 'pending' || !r.status);
                setRecords(relevantRecords);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProvinces = async () => {
        setTkgmLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/tkgm/provinces`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setProvinces(data.data);
                console.log('[DEBUG_TKGM_PROVINCES]', JSON.stringify(data.data.filter(p => p.text && p.text.toLowerCase().includes('bal')), null, 2));
            } else {
                setProvinces([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setTkgmLoading(false);
        }
    };

    useEffect(() => {
        console.log('[DEBUG] EfdalAI component mounted/token changed. Fetching records and provinces...');
        fetchRecords();
        fetchProvinces();
    }, [token]);

    useEffect(() => {
        if (activeTab === 'parsel' && provinces.length === 0) {
            fetchProvinces();
        }
    }, [activeTab]);

    const handleProvChange = async (id) => {
        setSelectedProv(id);
        setSelectedDist('');
        setSelectedNeig('');
        setNeighborhoods([]);
        if (!id) return;
        setTkgmLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/tkgm/districts/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setDistricts(data.data);
            } else {
                setDistricts([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setTkgmLoading(false);
        }
    };

    const handleDistChange = async (id) => {
        setSelectedDist(id);
        setSelectedNeig('');
        if (!id) return;
        setTkgmLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/tkgm/neighborhoods/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setNeighborhoods(data.data);
            } else {
                setNeighborhoods([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setTkgmLoading(false);
        }
    };

    const handleParcelSearch = async () => {
        setSearchingParcel(true);
        setParcelResult(null);
        setParcelAnalysis(null);
        try {
            let pId = selectedProv;
            let dId = selectedDist;
            let nId = selectedNeig;

            const normalize = (s) => (s || '')
                .toLocaleLowerCase('tr-TR')
                .replace(/ı/g, 'i')
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c')
                .replace(/\(.*\)/g, '')
                .replace(/buyuksehir/g, '')
                .replace(/belediyesi/g, '')
                .replace(/\s+/g, '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width hidden characters
                .replace(/["'.,]/g, '')
                .trim();
            // Store normalize globally on window for debug component
            window.__normalizeGeom = normalize;

            const getVariations = (name) => {
                const norm = normalize(name);
                if (norm === 'afyon' || norm === 'afyonkarahisar') return ['afyon', 'afyonkarahisar'];
                if (norm === 'eyup' || norm === 'eyupsultan') return ['eyup', 'eyupsultan'];
                if (norm === 'mersin' || norm === 'icel') return ['mersin', 'icel'];
                return [norm];
            };

            // 1. Resolve Province - ALWAYS KONYA (id: 64)
            pId = 64;

            // 2. Resolve District
            if (pId && !dId && distNameText) {
                const res = await fetch(`${API_BASE_URL}/tkgm/districts/${pId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                let textData = await res.text();
                textData = textData.replace(/^\uFEFF/, '');
                const data = JSON.parse(textData);
                if (data.success && Array.isArray(data.data)) {
                    const variations = getVariations(distNameText);
                    const match = data.data.find(d => {
                        const tkgmNorm = normalize(d.text);
                        return variations.some(v => tkgmNorm === v);
                    });
                    if (match) dId = match.id;
                } else if (!data.success && data.error) {
                    throw new Error(data.error);
                }
            }
            if (!dId && distNameText) throw new Error(`İlçe eşleştirilemedi: "${distNameText}"`);

            // 3. Resolve Neighborhood
            if (dId && !nId && neighNameText) {
                const res = await fetch(`${API_BASE_URL}/tkgm/neighborhoods/${dId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                let textData = await res.text();
                textData = textData.replace(/^\uFEFF/, '');
                const data = JSON.parse(textData);
                if (data.success && Array.isArray(data.data)) {
                    const normSearch = normalize(neighNameText).replace(/(mh|mah|mahallesi|koy|koyu)$/, '');
                    const match = data.data.find(n => {
                        const tkgmNorm = normalize(n.text).replace(/(mh|mah|mahallesi|koy|koyu)$/, '');
                        return tkgmNorm === normSearch;
                    });
                    if (match) nId = match.id;
                } else if (!data.success && data.error) {
                    throw new Error(data.error);
                }
            }
            if (!nId && neighNameText) throw new Error(`Mahalle eşleştirilemedi: "${neighNameText}"`);

            if (!nId) {
                throw new Error("Kayıt sorgulanabilmesi için konum bilgilerinin (İl, İlçe, Mahalle) eksiksiz olması gerekir.");
            }

            const cleanAda = String(ada).trim().replace(/\s+/g, '');
            const cleanParsel = String(parsel).trim().replace(/\s+/g, '');

            const res = await fetch(`${API_BASE_URL}/tkgm/parcel/${nId}/${cleanAda}/${cleanParsel}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                const unwrapped = Array.isArray(data.data) ? data.data[0] : data.data;
                setParcelResult(unwrapped);
            } else if (!data.success && data.error) {
                throw new Error(data.error);
            } else {
                alert('Parsel bulunamadı veya bir hata oluştu.');
            }
        } catch (err) {
            console.error(err);
            alert(err.message || 'Sorgulama başarısız.');
        } finally {
            setSearchingParcel(false);
        }
    };

    const handleAnalyzeParcel = async () => {
        if (!parcelResult) return;
        setAnalyzingParcel(true);
        setParcelAnalysis(null);
        try {
            const res = await fetch(`${API_BASE_URL}/ai/analyze-parcel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ parcelData: parcelResult.properties || parcelResult })
            });

            const data = await res.json();
            if (data.success && data.analysis) {
                setParcelAnalysis(data.analysis);
            } else {
                alert(data.error || 'Analiz sırasında bir hata oluştu');
            }
        } catch (err) {
            console.error(err);
            alert('Sunucuyla bağlantı kurulamadı.');
        } finally {
            setAnalyzingParcel(false);
        }
    };

    const handleAnalyze = async (id) => {
        console.log(`[DEBUG] handleAnalyze triggered for ID: ${id}. Current cooldown: ${cooldown}`);
        if (cooldown > 0) {
            console.warn('[DEBUG] handleAnalyze blocked by cooldown');
            return;
        }
        setAnalyzingId(id);
        try {
            const response = await fetch(`${API_BASE_URL}/ai/analyze/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setRecords(prev => prev.map(r => r.id === id ? { ...r, aiAnalysis: data.analysis } : r));
                const updatedRecord = { ...records.find(r => r.id === id), aiAnalysis: data.analysis };
                setSelectedRecord(updatedRecord);

                const duration = 90;
                const endTime = Date.now() + duration * 1000;
                localStorage.setItem('efdalai_cooldown_end', endTime.toString());
                setCooldown(duration);
            } else {
                if (response.status === 429) {
                    const duration = 90;
                    const endTime = Date.now() + duration * 1000;
                    localStorage.setItem('efdalai_cooldown_end', endTime.toString());
                    setCooldown(duration);
                }
                alert(data.error || 'Analiz sırasında bir hata oluştu.');
            }
        } catch (err) {
            console.error(err);
            alert('Sunucu hatası.');
        } finally {
            setAnalyzingId(null);
        }
    };

    const handleClearAnalysis = async (id) => {
        if (!window.confirm('Mevcut analizi temizlemek istediğinize emin misiniz?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/ai/clear/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setRecords(prev => prev.map(r => r.id === id ? { ...r, aiAnalysis: null } : r));
                if (selectedRecord?.id === id) {
                    setSelectedRecord({ ...selectedRecord, aiAnalysis: null });
                }
            }
        } catch (err) {
            console.error(err);
            alert('Temizleme hatası.');
        }
    };

    const handleListingSelect = (rec) => {
        if (!rec) return;

        // Reset previous selections
        setProvName('');
        setDistNameText('');
        setNeighNameText('');
        setSelectedProv('');
        setSelectedDist('');
        setSelectedNeig('');
        setAda('');
        setParsel('');

        // 1. Fill basic text fields
        setAda(rec.properties?.['Ada No'] || rec.properties?.['Ada'] || '');
        setParsel(rec.properties?.['Parsel No'] || rec.properties?.['Parsel'] || '');

        const recLoc = rec.location || ''; // E.g., "İstanbul / Kadıköy / Göztepe"
        const locParts = recLoc.split('/').map(s => s.trim());

        setProvName(locParts[0] || '');
        setDistNameText(locParts[1] || '');
        setNeighNameText(locParts[2] || '');

        console.log('[DEBUG] handleListingSelect filled text fields:', {
            il: locParts[0],
            ilce: locParts[1],
            mahalle: locParts[2],
            ada: rec.properties?.['Ada No'] || rec.properties?.['Ada'],
            parsel: rec.properties?.['Parsel No'] || rec.properties?.['Parsel']
        });

        setShowListingPicker(false);
    };

    const handleApproveRecord = async (id) => {
        if (!window.confirm('Bu ilanı onaylayıp portföyünüze taşımak istediğinize emin misiniz?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/records/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ note: 'EfdalAI üzerinden onaylandı.', status_tag: 'AI Onaylı' })
            });

            const result = await response.json();
            if (result.success) {
                setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
                if (selectedRecord?.id === id) {
                    setSelectedRecord({ ...selectedRecord, status: 'approved' });
                }
            }
        } catch (err) {
            console.error('Failed to approve:', err);
            alert('Onaylama hatası.');
        }
    };



    return (
        <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-0 flex flex-col md:flex-row justify-between items-start md:items-center px-4 md:px-0 gap-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <span className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </span>
                        EfdalAI <span className="text-gray-400 font-light ml-2">Asistan</span>
                    </h2>
                    <p className="text-gray-500 mt-2 text-sm">Gemini 2.0 destekli gayrimenkul zekası</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('analiz')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'analiz' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        İlan Analizi
                    </button>
                    <button
                        onClick={() => setActiveTab('parsel')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'parsel' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A2 2 0 013 15.487V6.513a2 2 0 011.553-1.943L9 3m6 17l5.447-2.724A2 2 0 0021 15.487V6.513a2 2 0 00-1.553-1.943L15 3m-6 17V3m6 17V3"></path></svg>
                        Parsel Sorgu
                    </button>
                </div>
            </header>

            <div className="h-px bg-gray-200 mt-6 mb-8 w-full"></div>

            <div className="px-4 md:px-0">
                {activeTab === 'analiz' ? (
                    <div className="grid lg:grid-cols-12 gap-8">
                        {/* Listings List */}
                        <div className="lg:col-span-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                    <p className="text-gray-500 font-medium">İlanlar yükleniyor...</p>
                                </div>
                            ) : (
                                records.length === 0 ? (
                                    <div className="p-8 text-center bg-white rounded-2xl border border-gray-100">
                                        <p className="text-gray-400">İlan bulunamadı.</p>
                                    </div>
                                ) : (
                                    records.map(record => (
                                        <div
                                            key={record.id}
                                            onClick={() => setSelectedRecord(record)}
                                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer bg-white group hover:shadow-md ${selectedRecord?.id === record.id ? 'border-indigo-500 shadow-indigo-100' : 'border-gray-100 shadow-sm'}`}
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                                                    {record.images?.[0] ? (
                                                        <img src={record.images[0]} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {record.status === 'pending' ? (
                                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-tighter rounded">BEKLİYOR</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-tighter rounded">ONAYLI</span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-gray-900 truncate leading-tight group-hover:text-indigo-600 transition-colors uppercase text-sm">{record.title}</h3>
                                                    <p className="text-indigo-600 font-bold text-sm mt-1">{record.price}</p>
                                                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-2">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                        <span className="truncate">
                                                            {record.location && record.location.includes('/') 
                                                                ? record.location.split('/').pop().trim() 
                                                                : record.location}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {record.aiAnalysis && (
                                                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded-full">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                                    Analiz Hazır
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )
                            )}
                        </div>

                        {/* Analysis Content */}
                        <div className="lg:col-span-8">
                            {activeTab === 'analiz' ? (
                                selectedRecord ? (
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] flex flex-col">
                                        <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div>
                                                    <h2 className="text-xl font-bold text-gray-900 line-clamp-1">{selectedRecord.title}</h2>
                                                    <p className="text-gray-500 text-sm mt-1">
                                                        {selectedRecord.location && selectedRecord.location.includes('/') 
                                                            ? selectedRecord.location.split('/').pop().trim() 
                                                            : selectedRecord.location} • {selectedRecord.price}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {selectedRecord.aiAnalysis && (
                                                        <button
                                                            onClick={() => handleClearAnalysis(selectedRecord.id)}
                                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all text-sm"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                            Temizle
                                                        </button>
                                                    )}
                                                    <button
                                                        disabled={analyzingId === selectedRecord.id || cooldown > 0}
                                                        onClick={() => handleAnalyze(selectedRecord.id)}
                                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg min-w-[160px] justify-center ${analyzingId === selectedRecord.id || cooldown > 0
                                                            ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                                            : selectedRecord.aiAnalysis
                                                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                                                                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-200'
                                                            }`}
                                                    >
                                                        {analyzingId === selectedRecord.id ? (
                                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Analiz...</>
                                                        ) : cooldown > 0 ? (
                                                            <>Bekleyin ({cooldown}s)</>
                                                        ) : selectedRecord.aiAnalysis ? (
                                                            <>Yenile</>
                                                        ) : (
                                                            <>AI'a Sor</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                                            {selectedRecord.aiAnalysis ? (() => {
                                                let analysis;
                                                try {
                                                    analysis = typeof selectedRecord.aiAnalysis === 'string'
                                                        ? JSON.parse(selectedRecord.aiAnalysis)
                                                        : selectedRecord.aiAnalysis;
                                                } catch (e) {
                                                    return <div>Analiz verisi okunamadı.</div>;
                                                }

                                                return (
                                                    <div className="space-y-8 animate-in fade-in duration-700">
                                                        <div className="bg-gray-900 p-8 rounded-3xl text-white flex gap-8 items-center">
                                                            <div className="flex-shrink-0 text-3xl font-black text-indigo-400">
                                                                %{analysis.score || 0}
                                                            </div>
                                                            <p className="text-gray-300 text-sm leading-relaxed">{analysis.summary}</p>
                                                        </div>

                                                        <div className="grid md:grid-cols-2 gap-6">
                                                            <div className="bg-green-50 p-6 rounded-2xl">
                                                                <h4 className="font-bold mb-3 text-green-800">Avantajlar</h4>
                                                                <ul className="space-y-2 text-sm text-green-700">
                                                                    {(analysis.pros || []).map((p, i) => <li key={i}>• {p}</li>)}
                                                                </ul>
                                                            </div>
                                                            <div className="bg-red-50 p-6 rounded-2xl">
                                                                <h4 className="font-bold mb-3 text-red-800">Riskler</h4>
                                                                <ul className="space-y-2 text-sm text-red-700">
                                                                    {(analysis.cons || []).map((c, i) => <li key={i}>• {c}</li>)}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })() : (
                                                <div className="h-full flex flex-col items-center justify-center opacity-40">
                                                    <h3 className="text-lg font-bold">Analiz Bekleniyor</h3>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-200 p-20 text-center">
                                        <h3 className="text-xl font-bold mb-2 text-gray-400">Başlamak için Bir İlan Seçin</h3>
                                    </div>
                                )
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white">
                                <h3 className="text-2xl font-bold flex items-center gap-3">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                    Resmi Parsel Sorgulama
                                </h3>
                                <p className="text-indigo-100 mt-2">Tapu ve Kadastro Genel Müdürlüğü servisleri üzerinden canlı sorgulama</p>
                            </div>

                            <div className="p-8">
                                <div className="mb-8 group">
                                    <button
                                        type="button"
                                        onClick={() => setShowListingPicker(true)}
                                        className="w-full p-6 bg-indigo-50 hover:bg-indigo-100/70 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-3xl transition-all flex flex-col items-center justify-center gap-4 text-indigo-600 transition-all active:scale-[0.98]"
                                    >
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-300">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-lg font-black uppercase tracking-tight block">Kayıtlı İlanlardan Veri Çek</span>
                                            <span className="text-sm text-indigo-400 font-medium">İl, ilçe, mahalle ve ada/parsel bilgilerini otomatik doldurur.</span>
                                        </div>
                                    </button>
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">İl (Sabit)</label>
                                        <input
                                            type="text"
                                            disabled
                                            className="w-full bg-gray-100 border-2 border-transparent rounded-2xl px-4 py-3 font-semibold text-gray-500 cursor-not-allowed outline-none"
                                            value="Konya"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">İlçe</label>
                                        <input
                                            type="text"
                                            placeholder="İlçe adı"
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 font-semibold text-gray-700 transition-all outline-none"
                                            value={distNameText}
                                            onChange={(e) => setDistNameText(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mahalle</label>
                                        <input
                                            type="text"
                                            placeholder="Mahalle adı"
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 font-semibold text-gray-700 transition-all outline-none"
                                            value={neighNameText}
                                            onChange={(e) => setNeighNameText(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mb-10">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Ada</label>
                                        <input
                                            type="text"
                                            placeholder="Sıfır ise 0 yazın"
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 font-semibold text-gray-700 transition-all outline-none"
                                            value={ada}
                                            onChange={(e) => setAda(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Parsel</label>
                                        <input
                                            type="text"
                                            placeholder="Parsel numarası"
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 font-semibold text-gray-700 transition-all outline-none"
                                            value={parsel}
                                            onChange={(e) => setParsel(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    disabled={!neighNameText || !ada || !parsel || searchingParcel}
                                    onClick={handleParcelSearch}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 text-lg tracking-wider"
                                >
                                    {searchingParcel ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            SORGULANIYOR...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                            RESMİ KAYITLARI GETİR
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* END DEBUG PANEL */}
                            {parcelResult && (
                                <div className="bg-gray-50 p-8 border-t border-gray-100 animate-in fade-in duration-500">
                                    <h4 className="text-gray-900 font-bold mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Sorgu Sonucu (Resmi Veri)
                                    </h4>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Alan</span>
                                            <span className="text-lg font-bold text-gray-900">{(parcelResult.properties || parcelResult).alan || '-'} m²</span>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nitelik</span>
                                            <span className="text-lg font-bold text-gray-900 truncate block">{(parcelResult.properties || parcelResult).nitelik || '-'}</span>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Mevkii</span>
                                            <span className="text-lg font-bold text-gray-900 truncate block">{(parcelResult.properties || parcelResult).mevkii || (parcelResult.properties || parcelResult).mevki || '-'}</span>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Pafta</span>
                                            <span className="text-lg font-bold text-gray-900">{(parcelResult.properties || parcelResult).pafta || '-'}</span>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-100">
                                        <div className="flex-1">
                                            <h4 className="text-xl font-bold mb-2">Bu veriyi AI ile analiz et?</h4>
                                            <p className="text-indigo-100 text-sm">Resmi tapu kayıtlarını EfdalAI asistanına göndererek imar ve bina yerleşim projeksiyonu alabilirsiniz.</p>
                                        </div>
                                        <button
                                            disabled={analyzingParcel}
                                            onClick={handleAnalyzeParcel}
                                            className="whitespace-nowrap bg-white text-indigo-600 px-8 py-3 rounded-2xl font-black hover:bg-indigo-50 active:scale-95 disabled:opacity-75 transition-all shadow-lg flex items-center justify-center gap-2"
                                        >
                                            {analyzingParcel ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                                    ANALİZ EDİLİYOR...
                                                </>
                                            ) : (
                                                'YAPAY ZEKA İLE ANALİZ ET'
                                            )}
                                        </button>
                                    </div>

                                    {/* AI Analysis Result Card */}
                                    {parcelAnalysis && (
                                        <div className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl border border-indigo-100 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            <div className="flex items-center gap-3 mb-6 border-b border-indigo-100 pb-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">EfdalAI Parsel Değerlendirmesi</h3>
                                                    <p className="text-indigo-600 font-medium text-sm">Resmi kayıtlara dayalı öngörü ve fizibilite raporu</p>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6 mb-8">
                                                {/* Buildable Status */}
                                                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-6 shadow-xl shadow-indigo-200 text-white relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                                                    <h4 className="flex items-center gap-2 font-bold mb-4 text-indigo-100 text-sm tracking-wider uppercase">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                        Yapılaşma İhtimali
                                                    </h4>
                                                    <p className="text-white leading-relaxed font-medium text-lg drop-shadow-sm">{parcelAnalysis.buildableStatus}</p>
                                                </div>

                                                {/* Agricultural Value */}
                                                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 shadow-xl shadow-emerald-200 text-white relative overflow-hidden group">
                                                    <div className="absolute bottom-0 right-0 -mb-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                                                    <h4 className="flex items-center gap-2 font-bold mb-4 text-emerald-100 text-sm tracking-wider uppercase">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                                                        Tarımsal/Ticari Potansiyel
                                                    </h4>
                                                    <p className="text-white leading-relaxed font-medium text-lg drop-shadow-sm">{parcelAnalysis.agriculturalValue}</p>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6">
                                                {/* Constraints */}
                                                <div className="bg-white rounded-3xl p-8 border border-red-100 shadow-sm flex flex-col">
                                                    <h4 className="flex items-center gap-3 text-red-600 font-bold mb-6 text-lg border-b border-red-50 pb-4">
                                                        <div className="p-2 bg-red-50 rounded-lg">
                                                            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        </div>
                                                        Muhtemel Kısıtlamalar
                                                    </h4>
                                                    <div className="flex-1 flex flex-col justify-center gap-3">
                                                        {(parcelAnalysis.constraints || []).length > 0 ? (
                                                            (parcelAnalysis.constraints || []).map((cons, idx) => (
                                                                <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-100/50">
                                                                    <div className="mt-1 w-2 h-2 rounded-full bg-red-400 flex-shrink-0 shadow-[0_0_8px_rgba(248,113,113,0.6)]"></div>
                                                                    <span className="text-sm font-medium text-red-900 leading-snug">{cons}</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="text-center p-6 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                                Kısıtlama tespit edilmedi.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Investment Potential - Progress Bar Visual */}
                                                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                                                    <h4 className="flex items-center gap-3 text-gray-900 font-bold mb-8 text-lg border-b border-gray-50 pb-4 relative z-10">
                                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                                        </div>
                                                        Yatırım Değeri
                                                    </h4>

                                                    <div className="flex-1 flex flex-col justify-center relative z-10">
                                                        <div className="flex items-end justify-center gap-2 mb-6">
                                                            <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-indigo-600 tracking-tighter">
                                                                {parcelAnalysis.investmentPotential?.split('/')[0]?.replace(/\D/g, '') || 7}
                                                            </span>
                                                            <span className="text-2xl font-bold text-gray-300 mb-2">/ 10</span>
                                                        </div>

                                                        {/* Progress Bar */}
                                                        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-6 shadow-inner">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                                                                style={{ width: `${(parseInt(parcelAnalysis.investmentPotential?.split('/')[0]?.replace(/\D/g, '') || 7) / 10) * 100}%` }}
                                                            ></div>
                                                        </div>

                                                        <p className="text-gray-600 text-sm text-center font-medium leading-relaxed bg-blue-50/50 p-4 rounded-2xl">
                                                            {parcelAnalysis.investmentPotential}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detailed Analysis (Moved to Bottom for hierarchy) */}
                                            <div className="mt-6 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                                                <h4 className="text-gray-900 font-black mb-4 text-xl flex items-center gap-3">
                                                    <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    Kapsamlı Analiz Raporu
                                                </h4>
                                                <p className="text-gray-600 leading-loose text-[15px]">{parcelAnalysis.detailedAnalysis}</p>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Listing Picker Modal for Parsel Sorgu */}
            {showListingPicker && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowListingPicker(false)}
                >
                    <div
                        className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 leading-tight">İlan Seç</h3>
                                    <p className="text-gray-500 text-sm font-medium mt-1">Parsel bilgilerini otomatik doldurmak için bir ilan seçin.</p>
                                </div>
                                <button onClick={() => setShowListingPicker(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="İlan başlığı veya konum ara..."
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white bg-white shadow-sm outline-none transition-all text-sm font-bold"
                                    value={listingSearch}
                                    onChange={e => setListingSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-6 space-y-3 custom-scrollbar">
                            {records
                                .filter(l => !listingSearch ||
                                    (l.title || '').toLocaleLowerCase('tr-TR').includes(listingSearch.toLocaleLowerCase('tr-TR')) ||
                                    (l.location || '').toLocaleLowerCase('tr-TR').includes(listingSearch.toLocaleLowerCase('tr-TR'))
                                )
                                .slice(0, 30)
                                .map(l => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        className="w-full flex gap-4 items-center p-4 rounded-2xl hover:bg-indigo-50 transition-all text-left group border-2 border-transparent hover:border-indigo-100 bg-gray-50/50"
                                        onClick={() => handleListingSelect(l)}
                                    >
                                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white border border-white shadow-sm">
                                            {l.images?.[0] ? (
                                                <img src={l.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-200">
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-gray-900 truncate group-hover:text-indigo-700 transition-colors uppercase tracking-tight">{l.title}</p>
                                            <p className="text-xs text-indigo-600 font-black mt-0.5">{l.price}</p>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                <p className="text-[10px] text-gray-400 font-bold truncate uppercase tracking-wider">
                                                    {l.location && l.location.includes('/') 
                                                        ? l.location.split('/').pop().trim() 
                                                        : l.location}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            }
                            {records.length === 0 && (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    <p className="text-gray-500 font-black uppercase tracking-widest text-sm">İlan Bulunamadı</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EfdalAI;
