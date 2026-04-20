import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { API_BASE_URL } from '../config';

const KONUT_FIELDS = [
    'İlan Tarihi', 'İlan No', 'm² (Brüt)', 'm² (Net)', 'Oda Sayısı', 'Bina Yaşı', 
    'Kat Sayısı', 'Isıtma', 'Banyo Sayısı', 'Açık Alan m²', 'Mutfak', 
    'Kullanım Durumu', 'Tapu Durumu', 'Site Adı', 'Otopark', 
    'Site İçerisinde', 'Eşyalı', 'Krediye Uygun', 'Takas', 'Aidat (TL)', 'Kimden'
];

const ARSA_FIELDS = [
    'İlan Tarihi', 'İlan No', 'm²', 'm² Fiyatı', 'Ada No', 'Parsel No', 
    'Pafta No', 'İmar Durumu', 'Tapu Durumu', 'Gabari', 'Kaks (Emsal)', 
    'Krediye Uygunluk', 'Takas', 'Kimden'
];

function ManualListingModal({ isOpen, onClose, token, onRefresh }) {
    const { showToast, showAlert } = useNotification();
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Form States
    const [formData, setFormData] = useState({
        title: '',
        price: '',
        currency: 'TL',
        mainCategory: 'Satılık',
        subCategory: 'Konut',
        description: '',
        location: '',
        sellerName: '',
        sellerPhone: '',
        officeName: '',
        images: [],
        properties: {} // We'll manage this separately for presets
    });

    // Preset values for each field
    const [presetProperties, setPresetProperties] = useState({});

    // Location States
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [neighborhoods, setNeighborhoods] = useState([]);
    const [selectedProv, setSelectedProv] = useState('');
    const [selectedDist, setSelectedDist] = useState('');
    const [selectedNeig, setSelectedNeig] = useState('');

    // Dynamic Properties State (Additional fields)
    const [customProps, setCustomProps] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchProvinces();
        }
    }, [isOpen]);

    // Update preset properties when category changes
    useEffect(() => {
        const fields = formData.subCategory === 'Konut' ? KONUT_FIELDS : 
                       formData.subCategory === 'Arsa' ? ARSA_FIELDS : [];
        
        const newPresets = {};
        fields.forEach(field => {
            newPresets[field] = '';
        });

        // Smart defaults
        if (formData.subCategory === 'Konut') newPresets['Emlak Tipi'] = 'Konut';
        if (formData.subCategory === 'Arsa') newPresets['Emlak Tipi'] = 'Arsa';
        newPresets['İlan Tarihi'] = new Date().toLocaleDateString('tr-TR');
        newPresets['İlan No'] = `M-${Date.now().toString().slice(-8)}`;

        setPresetProperties(newPresets);
    }, [formData.subCategory]);

    const fetchProvinces = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/tkgm/provinces`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setProvinces(data.data);
                const konya = data.data.find(p => p.text.includes('KONYA'));
                if (konya) handleProvChange(konya.id);
            }
        } catch (err) {
            console.error('Province fetch error:', err);
        }
    };

    const handleProvChange = async (id) => {
        setSelectedProv(id);
        setSelectedDist('');
        setSelectedNeig('');
        setDistricts([]);
        setNeighborhoods([]);
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/tkgm/districts/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setDistricts(data.data);
        } catch (err) {
            console.error('District fetch error:', err);
        }
    };

    const handleDistChange = async (id) => {
        setSelectedDist(id);
        setSelectedNeig('');
        setNeighborhoods([]);
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/tkgm/neighborhoods/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setNeighborhoods(data.data);
        } catch (err) {
            console.error('Neighborhood fetch error:', err);
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        const uploadedUrls = [];

        for (const file of files) {
            const uploadData = new FormData();
            uploadData.append('image', file);

            try {
                const res = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: uploadData
                });
                const result = await res.json();
                if (result.success) {
                    uploadedUrls.push(result.url);
                }
            } catch (err) { console.error('Image upload error:', err); }
        }

        setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
        setUploading(false);
    };

    const removeImage = (index) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const addProperty = () => setCustomProps([...customProps, { key: '', value: '' }]);
    const removeProperty = (index) => setCustomProps(customProps.filter((_, i) => i !== index));
    const updateProperty = (index, field, value) => {
        const updated = [...customProps];
        updated[index][field] = value;
        setCustomProps(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const prov = provinces.find(p => p.id === selectedProv)?.text || '';
        const dist = districts.find(d => d.id === selectedDist)?.text || '';
        const neig = neighborhoods.find(n => n.id === selectedNeig)?.text || '';
        const locationStr = [prov, dist, neig].filter(Boolean).join(' / ');

        // Merge presets and custom properties
        const finalProperties = { ...presetProperties };
        customProps.forEach(p => {
            if (p.key.trim()) finalProperties[p.key.trim()] = p.value;
        });

        // Ensure Emlak Tipi includes the operation for categorization
        if (finalProperties['Emlak Tipi']) {
            if (!finalProperties['Emlak Tipi'].includes(formData.mainCategory)) {
                finalProperties['Emlak Tipi'] = `${formData.mainCategory} ${finalProperties['Emlak Tipi']}`;
            }
        }

        const submissionData = {
            ...formData,
            price: `${formData.price} ${formData.currency}`,
            location: locationStr,
            properties: finalProperties,
            scrapedAt: new Date().toISOString()
        };

        try {
            const res = await fetch(`${API_BASE_URL}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(submissionData)
            });

            const result = await res.json();
            if (result.success) {
                showToast('İlan başarıyla eklendi.', 'success');
                onRefresh();
                onClose();
            } else {
                showAlert('Hata', result.error || 'İlan kaydedilemedi.');
            }
        } catch (err) {
            console.error('Save error:', err);
            showAlert('Sunucu Hatası', 'İlan kaydedilirken bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    const fieldsToRender = formData.subCategory === 'Konut' ? KONUT_FIELDS : 
                         formData.subCategory === 'Arsa' ? ARSA_FIELDS : [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                            <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            </span>
                            Manuel İlan Ekle
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Body */}
                <form id="manual-listing-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                    
                    {/* Basic Info */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                İlan Başlığı ve Fiyat
                            </h3>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-gray-500 ml-1">Başlık</label>
                                <input required type="text" className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Fiyat</label>
                                    <input required type="number" className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                                </div>
                                <div className="w-24 flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Döviz</label>
                                    <select className="bg-gray-50 border border-gray-200 rounded-2xl px-2 py-3 text-sm font-bold focus:outline-none" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})}>
                                        <option value="TL">TL</option><option value="USD">USD</option><option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                Kategori
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1">İşlem Türü</label>
                                    <select className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none" value={formData.mainCategory} onChange={(e) => setFormData({...formData, mainCategory: e.target.value})}>
                                        <option value="Satılık">Satılık</option><option value="Kiralık">Kiralık</option><option value="Devren Satılık">Devren Satılık</option><option value="Günlük Kiralık">Günlük Kiralık</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Alt Kategori</label>
                                    <select className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none" value={formData.subCategory} onChange={(e) => setFormData({...formData, subCategory: e.target.value})}>
                                        <option value="Konut">Konut</option><option value="Arsa">Arsa</option><option value="İş Yeri">İş Yeri</option><option value="Bina">Bina</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location Selection */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                            Konum
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <select className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold" value={selectedProv} onChange={(e) => handleProvChange(e.target.value)}>
                                <option value="">İl Seçiniz</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.text}</option>)}
                            </select>
                            <select disabled={!selectedProv} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50" value={selectedDist} onChange={(e) => handleDistChange(e.target.value)}>
                                <option value="">İlçe Seçiniz</option>{districts.map(d => <option key={d.id} value={d.id}>{d.text}</option>)}
                            </select>
                            <select disabled={!selectedDist} className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50" value={selectedNeig} onChange={(e) => setSelectedNeig(e.target.value)}>
                                <option value="">Mahalle Seçiniz</option>{neighborhoods.map(n => <option key={n.id} value={n.id}>{n.text}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Category Specific Properties (Rich Presets) */}
                    {fieldsToRender.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                {formData.subCategory.toUpperCase()} ÖZELLİKLERİ
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                {fieldsToRender.map(field => (
                                    <div key={field} className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight ml-1">{field}</label>
                                        <input 
                                            type="text" 
                                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                            value={presetProperties[field] || ''} 
                                            onChange={(e) => setPresetProperties({...presetProperties, [field]: e.target.value})}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description (HTML) */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                            İlan Açıklaması (HTML DESTEKLİ)
                        </h3>
                        <textarea 
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[200px]"
                            placeholder="İlan açıklamasını buraya yazabilir veya HTML kodu yapıştırabilirsiniz..."
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                    </div>

                    {/* Images */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                Görseller ({formData.images.length})
                            </h3>
                            <label className="cursor-pointer bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors">
                                Görsel Seç...
                                <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                        </div>
                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 min-h-[100px] bg-gray-50 p-4 rounded-3xl border-2 border-dashed border-gray-200">
                            {formData.images.map((url, i) => (
                                <div key={i} className="relative aspect-square group">
                                    <img src={url} className="w-full h-full object-cover rounded-2xl border shadow-sm" />
                                    <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                </div>
                            ))}
                            {uploading && <div className="aspect-square bg-white rounded-2xl flex items-center justify-center animate-pulse"><div className="w-6 h-6 border-2 border-t-indigo-600 rounded-full animate-spin"></div></div>}
                        </div>
                    </div>

                    {/* Additional Properties */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                EKSTRA ÖZELLİKLER
                            </h3>
                            <button type="button" onClick={addProperty} className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">+ Özellik Ekle</button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                            {customProps.map((p, i) => (
                                <div key={i} className="flex gap-2">
                                    <input placeholder="Başlık" className="w-1/3 bg-gray-50 border rounded-xl px-3 py-2 text-xs font-bold" value={p.key} onChange={(e) => updateProperty(i, 'key', e.target.value)} />
                                    <input placeholder="Değer" className="flex-1 bg-gray-50 border rounded-xl px-3 py-2 text-xs font-bold" value={p.value} onChange={(e) => updateProperty(i, 'value', e.target.value)} />
                                    <button onClick={() => removeProperty(i)} className="text-gray-400 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16"></path></svg></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Seller Details */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                            İLETİŞİM BİLGİLERİ
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <input placeholder="İsim Soyisim" className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold" value={formData.sellerName} onChange={(e) => setFormData({...formData, sellerName: e.target.value})} />
                            <input placeholder="Telefon" className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold" value={formData.sellerPhone} onChange={(e) => setFormData({...formData, sellerPhone: e.target.value})} />
                            <input placeholder="Ofis İsmi" className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold" value={formData.officeName} onChange={(e) => setFormData({...formData, officeName: e.target.value})} />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-4 justify-end">
                    <button onClick={onClose} className="px-6 py-3 rounded-2xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">Vazgeç</button>
                    <button form="manual-listing-form" type="submit" disabled={isLoading || uploading} className="px-10 py-3 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl disabled:opacity-50 flex items-center gap-2">
                        {isLoading ? <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin"></div> : 'KAYDET VE YAYINLA'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ManualListingModal;
