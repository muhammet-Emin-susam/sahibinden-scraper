import { useState, useEffect, useContext } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { AuthContext } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';


// Parse text and convert URLs to clickable links
function renderContent(text) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
        urlRegex.test(part) ? (
            <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 break-all"
            >
                {part}
            </a>
        ) : (
            part
        )
    );
}

function Announcements() {
    const { showToast, showAlert, showConfirm } = useNotification();
    const { token, user } = useContext(AuthContext);
    const [announcements, setAnnouncements] = useState([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('Duyuru');
    const [imageUrl, setImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [selectedAnn, setSelectedAnn] = useState(null);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(true);
    const [quotedListing, setQuotedListing] = useState(null);
    const [allListings, setAllListings] = useState([]);
    const [showListingPicker, setShowListingPicker] = useState(false);
    const [listingSearch, setListingSearch] = useState('');

    const fetchAnnouncements = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/announcements`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAnnouncements(data.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setMsg({ type: '', text: '' });

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setImageUrl(data.url);
                showToast('Görsel yüklendi.', 'success');
            } else {
                showAlert('Hata', data.error || 'Yükleme başarısız.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            showAlert('Hata', 'Görsel yüklenirken bir hata oluştu.');
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchAnnouncements();
            fetch(`${API_BASE_URL}/records`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).then(d => {
                if (d.success) setAllListings(d.data || []);
            }).catch(() => { });
        }
    }, [token]);

    const handleCreateAnnouncement = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            const response = await fetch(`${API_BASE_URL}/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, content, type, imageUrl, quotedListing })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Duyuru başarıyla yayınlandı.', 'success');
                setTitle('');
                setContent('');
                setType('Duyuru');
                setImageUrl('');
                setQuotedListing(null);
                fetchAnnouncements();
            } else {
                showAlert('Hata', data.error || 'Duyuru yayınlanamadı.');
            }
        } catch (err) {
            console.error('Announce Creation Error:', err);
            showAlert('Hata', 'Paylaşım sırasında bir sunucu hatası oluştu.');
        }
    };

    const handleDeleteAnnouncement = async (id) => {
        if (!(await showConfirm('Duyuruyu Sil', 'Bu duyuruyu silmek istediğinize emin misiniz?'))) return;
        try {
            const response = await fetch(`${API_BASE_URL}/announcements/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                fetchAnnouncements();
                showToast('Duyuru silindi.', 'success');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showAlert('Hata', 'Silme işlemi başarısız oldu.');
        }
    };

    return (
        <>
            <div className="min-h-screen  flex flex-col">
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                        </span>
                        Duyurular
                    </h1>
                    <p className="text-gray-500 mt-2">Sistem genelindeki önemli bildirimler ve güncellemeler.</p>
                </header>

                <div className="grid lg:grid-cols-12 gap-8">
                    {/* Admin Creation Form */}
                    {user?.role === 'admin' && (
                        <div className="lg:col-span-4">
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 sticky top-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    Yeni Duyuru Yayınla
                                </h2>

                                {msg.text && (
                                    <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${msg.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                        {msg.text}
                                    </div>
                                )}

                                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Başlık</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Duyuru başlığı..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Tür</label>
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                            value={type}
                                            onChange={(e) => setType(e.target.value)}
                                        >
                                            <option value="Duyuru">Duyuru</option>
                                            <option value="Müşteri Talebi">Müşteri Talebi</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">İçerik</label>
                                        <textarea
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-32 resize-none"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="Duyuru detayları..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Görsel (Bilgisayardan Seç)</label>
                                        <div className="flex gap-4 items-center">
                                            <label className="flex-1 cursor-pointer">
                                                <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-gray-500">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                    <span>{uploading ? 'Yükleniyor...' : (imageUrl ? 'Görsel Değiştir' : 'Dosya Seç')}</span>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleFileUpload}
                                                    accept="image/*"
                                                    disabled={uploading}
                                                />
                                            </label>
                                            {imageUrl && (
                                                <div className="w-14 h-14 rounded-xl overflow-hidden border border-indigo-100 shadow-sm relative group">
                                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setImageUrl('')}
                                                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Listing Quote Picker */}
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">İlan Alıntısı (Opsiyonel)</label>
                                        {quotedListing ? (
                                            <div className="border border-indigo-100 bg-indigo-50 rounded-xl p-3 flex gap-3 items-start">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-indigo-700 truncate">{quotedListing.title}</p>
                                                    <p className="text-xs text-indigo-500">{quotedListing.price}</p>
                                                </div>
                                                <button type="button" onClick={() => setQuotedListing(null)} className="text-indigo-400 hover:text-red-500">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowListingPicker(true)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-gray-500 text-sm"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                İlan Seç
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                    >
                                        Yayınla
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Announcements List */}
                    <div className={user?.role === 'admin' ? "lg:col-span-8" : "lg:col-span-12"}>
                        <div className="space-y-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                    <p className="text-gray-500">Duyurular yükleniyor...</p>
                                </div>
                            ) : announcements.length === 0 ? (
                                <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Henüz Duyuru Yok</h3>
                                    <p className="text-gray-500">Yönetici tarafından paylaşılan duyurular burada listelenecek.</p>
                                </div>
                            ) : (
                                announcements.map((ann) => (
                                    <div key={ann.id} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors uppercase leading-tight tracking-tight mb-2">
                                                    {ann.title}
                                                </h3>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${ann.type === 'Müşteri Talebi' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                                        {ann.type || 'Duyuru'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                        {new Date(ann.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{ann.author}</span>
                                                {user?.role === 'admin' && (
                                                    <button
                                                        onClick={() => handleDeleteAnnouncement(ann.id)}
                                                        className="mt-1 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                                        title="Duyuruyu Sil"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {ann.imageUrl && (
                                            <div
                                                className="mb-6 rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in group/img relative"
                                                onClick={() => setSelectedAnn(ann)}
                                            >
                                                <img src={ann.imageUrl} alt={ann.title} className="w-full h-auto max-h-[400px] object-cover transition-transform duration-300 group-hover/img:scale-[1.02]" />
                                                <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                    <span className="bg-white/90 backdrop-blur-md text-indigo-600 text-xs font-black px-4 py-2 rounded-full shadow-lg">
                                                        Tam Ekranda Gör →
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="text-gray-600 leading-relaxed text-lg whitespace-pre-wrap break-words border-l-4 border-indigo-50 pl-6 py-2">
                                            {renderContent(ann.content)}
                                        </div>

                                        {/* Quoted Listing Card */}
                                        {ann.quotedListing && (
                                            <div className="mt-5 pt-4 border-t border-gray-100">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                    Alıntılanan İlan
                                                </p>
                                                <a
                                                    href={ann.quotedListing.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex gap-4 p-4 border-l-4 border-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-r-2xl transition-colors group/listing"
                                                >
                                                    {ann.quotedListing.imageUrl && (
                                                        <img
                                                            src={ann.quotedListing.imageUrl}
                                                            alt=""
                                                            className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border-2 border-white shadow-md"
                                                        />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-base font-black text-gray-900 group-hover/listing:text-indigo-700 transition-colors leading-tight">{ann.quotedListing.title}</p>
                                                        <p className="text-sm font-bold text-indigo-600 mt-1">{ann.quotedListing.price}</p>
                                                        {(ann.quotedListing.location || ann.quotedListing.neighborhood) && (
                                                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                {ann.quotedListing.location && ann.quotedListing.location.includes('/') 
                                                                    ? ann.quotedListing.location.split('/').pop().trim() 
                                                                    : (ann.quotedListing.neighborhood || ann.quotedListing.location || '')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex-shrink-0 self-center">
                                                        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white group-hover/listing:scale-110 transition-transform shadow-sm">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                        </div>
                                                    </div>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <AnnouncementModal ann={selectedAnn} onClose={() => setSelectedAnn(null)} />

            {/* Listing Picker Modal */}
            {showListingPicker && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowListingPicker(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 mb-3">İlan Seç</h3>
                            <input
                                type="text"
                                autoFocus
                                placeholder="İlan başlığı ara..."
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                value={listingSearch}
                                onChange={e => setListingSearch(e.target.value)}
                            />
                        </div>
                        <div className="overflow-y-auto flex-1 p-3">
                            {allListings
                                .filter(l => !listingSearch || (l.title || '').toLowerCase().includes(listingSearch.toLowerCase()))
                                .slice(0, 30)
                                .map(l => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        className="w-full flex gap-3 items-center p-3 rounded-xl hover:bg-indigo-50 transition-colors text-left group"
                                        onClick={() => {
                                            setQuotedListing({
                                                id: l.id,
                                                title: l.title,
                                                price: l.price,
                                                location: l.location || '',
                                                neighborhood: l.neighborhood || '',
                                                imageUrl: l.imageUrl || l.image || '',
                                                url: l.url || ''
                                            });
                                            setShowListingPicker(false);
                                            setListingSearch('');
                                        }}
                                    >
                                        {(l.imageUrl || l.image) && (
                                            <img src={l.imageUrl || l.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600">{l.title}</p>
                                            <p className="text-xs text-indigo-600 font-semibold">{l.price}</p>
                                            {(l.location || l.neighborhood) && (
                                                <p className="text-xs text-gray-400 truncate">
                                                    {l.location && l.location.includes('/') 
                                                        ? l.location.split('/').pop().trim() 
                                                        : (l.neighborhood || l.location || '')}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))
                            }
                            {allListings.length === 0 && (
                                <p className="text-center text-gray-400 text-sm py-8">Kayıtlı ilan bulunamadı.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Announcement Detail Modal
function AnnouncementModal({ ann, onClose }) {
    useEffect(() => {
        if (ann) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [ann]);

    if (!ann) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="flex w-full h-full flex-col md:flex-row animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Image Panel — dark background, fills the left */}
                <div className="md:w-3/5 h-1/2 md:h-full bg-gray-950 flex items-center justify-center overflow-hidden">
                    {ann.imageUrl ? (
                        <img
                            src={ann.imageUrl}
                            alt={ann.title}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center text-gray-600">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        </div>
                    )}
                </div>

                {/* Detail Panel — white, scrollable, fills right */}
                <div className="md:w-2/5 h-1/2 md:h-full bg-white flex flex-col overflow-y-auto">
                    <div className="p-6 md:p-8 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-5">
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                Bilgilendirme
                            </span>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-tight mb-3">
                            {ann.title}
                        </h2>

                        {/* Author & Date */}
                        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-900">{ann.author}</p>
                                <p className="text-xs text-gray-400">
                                    {new Date(ann.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 text-gray-600 leading-relaxed whitespace-pre-wrap break-words border-l-4 border-indigo-100 pl-4 py-1">
                            {renderContent(ann.content)}
                        </div>

                        {/* Quoted Listing */}
                        {ann.quotedListing && (
                            <div className="mt-5 pt-4 border-t border-gray-100">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    Alıntılanan İlan
                                </p>
                                <a
                                    href={ann.quotedListing.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex gap-3 p-4 border-l-4 border-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-r-2xl transition-colors group/listing"
                                >
                                    {ann.quotedListing.imageUrl && (
                                        <img src={ann.quotedListing.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border-2 border-white shadow-md" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-gray-900 group-hover/listing:text-indigo-700 transition-colors">{ann.quotedListing.title}</p>
                                        <p className="text-sm font-bold text-indigo-600 mt-0.5">{ann.quotedListing.price}</p>
                                        {(ann.quotedListing.location || ann.quotedListing.neighborhood) && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {ann.quotedListing.location && ann.quotedListing.location.includes('/') 
                                                    ? ann.quotedListing.location.split('/').pop().trim() 
                                                    : (ann.quotedListing.neighborhood || ann.quotedListing.location || '')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 self-center">
                                        <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-sm group-hover/listing:scale-110 transition-transform">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Announcements;
