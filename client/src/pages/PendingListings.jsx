import React, { useState, useEffect, useContext } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { tr } from 'date-fns/locale';


function PendingListings() {
    const { showToast, showAlert, showConfirm } = useNotification();
    const [pendingRecords, setPendingRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRecordId, setExpandedRecordId] = useState(null);
    const [galleryData, setGalleryData] = useState(null); // { items: [], index: 0 }
    const [isZoomed, setIsZoomed] = useState(false);
    const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const thumbScrollRef = React.useRef(null);

    const { token, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // Approval specific states
    const [approvalNotes, setApprovalNotes] = useState({});
    const [approvalStatuses, setApprovalStatuses] = useState({});

    // Demand Match states
    const [showDemandModal, setShowDemandModal] = useState(false);
    const [demands, setDemands] = useState([]);
    const [selectedListingForDemand, setSelectedListingForDemand] = useState(null);
    const [matchingDemand, setMatchingDemand] = useState(false);

    // Advanced Filtering states
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [sortBy, setSortBy] = useState('newest_scraped');

    // Filtering categories
    const [selectedNeighborhood, setSelectedNeighborhood] = useState('Tümü');
    const [selectedUser, setSelectedUser] = useState(user?.role === 'admin' ? '' : 'Tümü');
    const [selectedMainCategory, setSelectedMainCategory] = useState('Tümü');
    const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!galleryData) return;
            if (e.key === 'ArrowRight') handleNextImage(e);
            if (e.key === 'ArrowLeft') handlePrevImage(e);
            if (e.key === 'Escape') setGalleryData(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [galleryData]);

    useEffect(() => {
        if (galleryData && thumbScrollRef.current) {
            const activeThumb = thumbScrollRef.current.children[galleryData.index];
            if (activeThumb) {
                activeThumb.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [galleryData?.index]);

    const handlePrevImage = (e) => {
        if (e) e.stopPropagation();
        if (!galleryData) return;
        setGalleryData(prev => ({
            ...prev,
            index: (prev.index - 1 + prev.items.length) % prev.items.length
        }));
        setIsZoomed(false);
        setZoomPos({ x: 0, y: 0 });
    };

    const handleNextImage = (e) => {
        if (e) e.stopPropagation();
        if (!galleryData) return;
        setGalleryData(prev => ({
            ...prev,
            index: (prev.index + 1) % prev.items.length
        }));
        setIsZoomed(false);
        setZoomPos({ x: 0, y: 0 });
    };

    const handleZoomToggle = (e) => {
        if (e) e.stopPropagation();
        const newZoomed = !isZoomed;
        setIsZoomed(newZoomed);
        if (!newZoomed) setZoomPos({ x: 0, y: 0 });
    };

    const handleMouseDown = (e) => {
        if (!isZoomed) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - zoomPos.x, y: e.clientY - zoomPos.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !isZoomed) return;
        setZoomPos({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const fetchRecords = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/records`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (result.success) {
                // Sadece 'pending' olanları filtrele
                const pendings = result.data.filter(r => r.status === 'pending');
                setPendingRecords(pendings);
            } else if (response.status === 401 || response.status === 403) {
                logout();
                navigate('/login');
            }
        } catch (err) {
            console.error('Failed to fetch records:', err);
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') {
            navigate('/home');
            return;
        }
        const initFetch = async () => {
            setIsLoading(true);
            await fetchRecords();
            setIsLoading(false);
        };
        initFetch();
        const interval = setInterval(fetchRecords, 5000);
        return () => clearInterval(interval);
    }, [token, user, navigate]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        selectedNeighborhood,
        selectedUser,
        selectedMainCategory,
        selectedSubCategory,
        searchTerm,
        minPrice,
        maxPrice,
        startDate,
        endDate
    ]);

    useEffect(() => {
        const mainContainer = document.querySelector('main > div.overflow-y-auto');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentPage]);

    const mainCategories = ['Tümü', 'Satılık', 'Kiralık', 'Günlük Kiralık', 'Devren Satılık', 'Devren Kiralık', 'Kat Karşılığı', 'Diğer'];
    const subCategories = ['Tümü', 'Konut', 'İş Yeri', 'Arsa', 'Tarla', 'Bahçe', 'Bağ', 'Zeytinlik', 'Bina', 'Devre Mülk', 'Turistik Tesis', 'Diğer'];

    const neighborhoods = ['Tümü', ...new Set(pendingRecords.map(r => {
        if (!r.location) return 'Diğer';
        const parts = String(r.location).split('/');
        return parts.length >= 3 ? parts[2].trim() : 'Diğer';
    }))].sort();

    const uniqueUsers = [...new Map(pendingRecords.map(r => [
        r.username || 'Bilinmiyor',
        { username: r.username || 'Bilinmiyor', displayName: String(r.displayName || r.username || 'Bilinmiyor') }
    ])).values()].sort((a, b) => a.displayName.localeCompare(b.displayName));

    const filteredRecords = pendingRecords.filter(r => {
        const nMatch = selectedNeighborhood === 'Tümü' ||
            (selectedNeighborhood === 'Diğer' && !r.location) ||
            (r.location && String(r.location).split('/').length >= 3 && String(r.location).split('/')[2].trim() === selectedNeighborhood);

        let uMatch = true;
        if (user?.role === 'admin') {
            if (selectedUser === '') uMatch = false;
            else if (selectedUser !== 'Tümü') uMatch = (r.username || 'Bilinmiyor') === selectedUser;
        } else {
            uMatch = selectedUser === 'Tümü' || (r.username || 'Bilinmiyor') === selectedUser;
        }

        const mMatch = selectedMainCategory === 'Tümü' || r.mainCategory === selectedMainCategory;
        const sMatch = selectedSubCategory === 'Tümü' || r.subCategory === selectedSubCategory;

        let searchMatch = true;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const title = String(r.title || '').toLowerCase();
            const loc = String(r.location || '').toLowerCase();
            const ilanNo = String(r.properties?.['İlan No'] || '');
            const sellerName = String(r.sellerName || '').toLowerCase();
            searchMatch = title.includes(term) || loc.includes(term) || ilanNo.includes(term) || sellerName.includes(term);
        }

        let priceMatch = true;
        if (minPrice || maxPrice) {
            const cleanPriceStr = (pStr) => {
                if (!pStr) return 0;
                let numericStr = String(pStr).replace(/[^0-9]/g, '');
                return numericStr ? parseInt(numericStr, 10) : 0;
            };
            const recordPrice = cleanPriceStr(r.price);
            const minP = minPrice ? parseInt(minPrice, 10) : 0;
            const maxP = maxPrice ? parseInt(maxPrice, 10) : Infinity;
            if (minPrice && maxPrice) priceMatch = recordPrice >= minP && recordPrice <= maxP;
            else if (minPrice) priceMatch = recordPrice >= minP;
            else if (maxPrice) priceMatch = recordPrice <= maxP;
        }

        let dateMatch = true;
        if (startDate || endDate) {
            const recordDate = new Date(r.scrapedAt);
            recordDate.setHours(0, 0, 0, 0);
            let sDate = startDate ? new Date(startDate) : null;
            if (sDate) sDate.setHours(0, 0, 0, 0);
            let eDate = endDate ? new Date(endDate) : null;
            if (eDate) eDate.setHours(23, 59, 59, 999);
            if (startDate && endDate) dateMatch = recordDate >= sDate && recordDate <= eDate;
            else if (startDate) dateMatch = recordDate >= sDate;
            else if (endDate) dateMatch = recordDate <= eDate;
        }

        return nMatch && uMatch && mMatch && sMatch && searchMatch && priceMatch && dateMatch;
    });

    const resetFilters = () => {
        setSelectedNeighborhood('Tümü');
        if (user?.role !== 'admin') setSelectedUser('Tümü');
        setSelectedMainCategory('Tümü');
        setSelectedSubCategory('Tümü');
        setSearchTerm('');
        setMinPrice('');
        setMaxPrice('');
        setStartDate(null);
        setEndDate(null);
        setSortBy('newest_scraped');
        setCurrentPage(1);
    };

    const sortedRecords = [...filteredRecords].sort((a, b) => {
        const cleanPrice = (pStr) => {
            if (!pStr) return 0;
            let numericStr = String(pStr).replace(/[^0-9]/g, '');
            return numericStr ? parseInt(numericStr, 10) : 0;
        };

        switch (sortBy) {
            case 'newest_scraped': return new Date(b.scrapedAt) - new Date(a.scrapedAt);
            case 'oldest_scraped': return new Date(a.scrapedAt) - new Date(b.scrapedAt);
            case 'price_desc': return cleanPrice(b.price) - cleanPrice(a.price);
            case 'price_asc': return cleanPrice(a.price) - cleanPrice(b.price);
            default: return 0;
        }
    });

    const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentRecords = sortedRecords.slice(indexOfFirstItem, indexOfLastItem);

    const handleDeleteRecord = async (e, id) => {
        e.stopPropagation();
        if (!(await showConfirm('İlanı Sil', 'Bu bekleyen ilanı silmek istediğinize emin misiniz?'))) return;

        try {
            await fetch(`${API_BASE_URL}/records/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setPendingRecords(prev => prev.filter(record => record.id !== id));
            showToast('İlan silindi.', 'success');
        } catch (err) {
            console.error('Failed to delete:', err);
            showAlert('Hata', 'Silme işlemi başarısız oldu.');
        }
    };

    const handleApproveRecord = async (e, id) => {
        e.stopPropagation();
        if (!(await showConfirm('İlanı Onayla', 'Bu ilanı onaylayıp portföyünüze taşımak istediğinize emin misiniz?'))) return;

        const note = approvalNotes[id] || '';
        const status_tag = approvalStatuses[id] || '';

        try {
            const response = await fetch(`${API_BASE_URL}/records/${id}/approve`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ note, status_tag })
            });

            const result = await response.json();
            if (result.success) {
                setPendingRecords(prev => prev.filter(record => record.id !== id));
                showToast('İlan onaylandı.', 'success');
            }
        } catch (err) {
            console.error('Failed to approve:', err);
            showAlert('Hata', 'Onaylama işlemi başarısız oldu.');
        }
    };

    const fetchDemands = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/demands`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setDemands(data.data.filter(d => d.status === 'Aktif'));
            }
        } catch (err) {
            console.error('Failed to fetch demands:', err);
        }
    };

    const handleOpenDemandModal = (e, record) => {
        e.stopPropagation();
        setSelectedListingForDemand(record);
        fetchDemands();
        setShowDemandModal(true);
    };

    const handleMatchToDemand = async (demandId) => {
        setMatchingDemand(true);
        try {
            const payload = {
                listing: {
                    id: selectedListingForDemand.id,
                    title: selectedListingForDemand.title,
                    price: selectedListingForDemand.price,
                    city: selectedListingForDemand.location?.split(',')[0] || '',
                    district: selectedListingForDemand.location?.split(',')[1] || '',
                    neighborhood: selectedListingForDemand.location?.split(',')[2] || ''
                }
            };

            const res = await fetch(`${API_BASE_URL}/demands/${demandId}/match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                setPendingRecords(prev => prev.filter(record => record.id !== selectedListingForDemand.id));
                setShowDemandModal(false);
                showToast('İlan başarıyla talebe eklendi.', 'success');
            } else {
                showAlert('Hata', data.error || 'İşlem başarısız.');
            }
        } catch (err) {
            console.error('Failed to match demand:', err);
            showAlert('Hata', 'Talebe ekleme başarısız oldu.');
        } finally {
            setMatchingDemand(false);
        }
    };

    const toggleExpand = (id) => {
        setExpandedRecordId(expandedRecordId === id ? null : id);
    };

    return (
        <div className="font-sans animate-fade-in pb-10">
            {galleryData && (
                <div
                    className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-fade-in overflow-hidden"
                    onClick={() => {
                        setGalleryData(null);
                        setIsZoomed(false);
                    }}
                >
                    {/* Header: Counter & Close */}
                    <div className="flex items-center justify-between p-6 z-[70] relative">
                        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
                            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">İlan Fotoğrafları</span>
                            <div className="h-3 w-[1px] bg-white/10"></div>
                            <span className="text-white font-bold text-sm">
                                {galleryData.index + 1} / {galleryData.items.length}
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                className={`p-3 rounded-2xl transition-all z-[70] border active:scale-95 ${isZoomed ? 'bg-blue-500 border-blue-400 text-white' : 'text-white bg-white/10 hover:bg-white/20 border-white/5'}`}
                                onClick={handleZoomToggle}
                                title="Yakınlaştır / Uzaklaştır"
                            >
                                {isZoomed ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                )}
                            </button>
                            <button
                                className="text-white hover:text-white bg-red-500/20 hover:bg-red-500/40 p-3 rounded-2xl transition-all z-[70] border border-red-500/20 active:scale-95"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setGalleryData(null);
                                    setIsZoomed(false);
                                }}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    </div>

                    {/* Main Image Area */}
                    <div className="flex-1 relative flex items-center justify-center overflow-auto custom-scrollbar group/gallery">
                        {/* Navigation Areas (Invisible but clickable on sides) */}
                        {!isZoomed && (
                            <>
                                <div 
                                    className="absolute left-0 top-0 bottom-0 w-[15%] z-20 cursor-pointer hidden md:block" 
                                    onClick={handlePrevImage}
                                />
                                <div 
                                    className="absolute right-0 top-0 bottom-0 w-[15%] z-20 cursor-pointer hidden md:block" 
                                    onClick={handleNextImage}
                                />
                            </>
                        )}

                        {/* Arrows */}
                        {!isZoomed && galleryData.items.length > 1 && (
                            <>
                                <button
                                    className="absolute left-8 z-30 p-4 rounded-3xl bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-xl transition-all duration-300 opacity-0 group-hover/gallery:opacity-100 -translate-x-4 group-hover/gallery:translate-x-0 hidden md:block"
                                    onClick={handlePrevImage}
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                </button>
                                <button
                                    className="absolute right-8 z-30 p-4 rounded-3xl bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-xl transition-all duration-300 opacity-0 group-hover/gallery:opacity-100 translate-x-4 group-hover/gallery:translate-x-0 hidden md:block"
                                    onClick={handleNextImage}
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                            </>
                        )}

                        <div 
                            className={`m-auto ${!isDragging ? 'transition-transform duration-300' : ''} ${isZoomed ? 'cursor-grab active:cursor-grabbing' : 'max-h-full max-w-full'}`}
                            style={isZoomed ? { transform: `translate(${zoomPos.x}px, ${zoomPos.y}px)` } : {}}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <img
                                src={galleryData.items[galleryData.index]}
                                className={`transition-all duration-500 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] select-none ${isZoomed
                                    ? 'scale-[2.5] cursor-grab active:cursor-grabbing'
                                    : 'max-w-full max-h-[75vh] object-contain cursor-zoom-in'
                                    }`}
                                onClick={handleZoomToggle}
                                alt={`Gallery ${galleryData.index}`}
                                draggable="false"
                            />
                        </div>
                    </div>

                    <div 
                        className="bg-black/60 backdrop-blur-3xl border-t border-white/5 p-6 z-[70] animate-in slide-in-from-bottom-5 duration-500"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div 
                            ref={thumbScrollRef}
                            className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar group/thumbs scroll-smooth"
                        >
                            {galleryData.items.map((img, idx) => (
                                <div
                                    key={idx}
                                    className={`flex-none w-20 h-14 md:w-24 md:h-16 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                                        galleryData.index === idx 
                                        ? 'border-blue-500 scale-110 shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                                        : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'
                                    }`}
                                    onClick={() => {
                                        setGalleryData({ ...galleryData, index: idx });
                                        setIsZoomed(false);
                                    }}
                                >
                                    <img src={img} className="w-full h-full object-cover" loading="lazy" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Onay Bekleyen İlanlar ({filteredRecords.length})
                </h2>
                <div className="flex gap-3">
                    <button
                        onClick={resetFilters}
                        className="bg-white hover:bg-gray-50 text-red-600 font-semibold py-2 px-4 rounded-lg shadow border border-gray-200 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Filtreleri Temizle
                    </button>
                    <button
                        onClick={fetchRecords}
                        className="bg-white hover:bg-gray-50 text-gray-600 font-semibold py-2 px-4 rounded-lg shadow border border-gray-200 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Yenile
                    </button>
                </div>
            </div>

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

                    <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Sıralama:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-lg focus:ring-2 focus:ring-blue-500/50 block p-2 outline-none cursor-pointer transition-all hover:bg-gray-100 min-w-[160px]"
                        >
                            <option value="newest_scraped">En Yeni İlan</option>
                            <option value="oldest_scraped">En Eski İlan</option>
                            <option value="price_desc">Fiyat (Önce En Yüksek)</option>
                            <option value="price_asc">Fiyat (Önce En Düşük)</option>
                        </select>
                    </div>

                    <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${showAdvancedFilters ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                        Gelişmiş Filtreler
                        <svg className={`w-4 h-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                </div>

                {/* Advanced Filters Panel */}
                {showAdvancedFilters && (
                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm animate-fade-in-up">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Search Filter */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    Arama
                                </label>
                                <input
                                    type="text"
                                    placeholder="İlan Başlığı, No, Konum vb."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                />
                            </div>

                            {/* Price Range */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Fiyat Aralığı (TL)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={minPrice}
                                        onChange={(e) => setMinPrice(e.target.value)}
                                        className="w-1/2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                    />
                                    <span className="text-gray-400 font-bold">-</span>
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={maxPrice}
                                        onChange={(e) => setMaxPrice(e.target.value)}
                                        className="w-1/2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    Eklenme Tarihi
                                </label>
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">
                                    <div className="w-1/2 relative">
                                        <DatePicker
                                            selected={startDate}
                                            onChange={(date) => setStartDate(date)}
                                            locale={tr}
                                            dateFormat="dd.MM.yyyy"
                                            placeholderText="Başlangıç"
                                            className="w-full bg-transparent border-none px-3 py-2 text-sm text-gray-700 font-medium focus:outline-none cursor-pointer"
                                            isClearable
                                            portalId="root"
                                            autoComplete="off"
                                            showYearDropdown
                                            scrollableYearDropdown
                                        />
                                    </div>
                                    <div className="w-px h-6 bg-gray-300"></div>
                                    <div className="w-1/2 relative">
                                        <DatePicker
                                            selected={endDate}
                                            onChange={(date) => setEndDate(date)}
                                            locale={tr}
                                            dateFormat="dd.MM.yyyy"
                                            placeholderText="Bitiş"
                                            className="w-full bg-transparent border-none px-3 py-2 text-sm text-gray-700 font-medium focus:outline-none cursor-pointer"
                                            isClearable
                                            portalId="root"
                                            autoComplete="off"
                                            showYearDropdown
                                            scrollableYearDropdown
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Neighborhood Filter Tabs */}
                {neighborhoods.length > 2 && (
                    <div className="flex items-center gap-2 max-w-full">
                        <button
                            onClick={() => setSelectedNeighborhood('Tümü')}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border flex-shrink-0 z-10 ${selectedNeighborhood === 'Tümü'
                                ? 'bg-orange-600 border-orange-500 text-white shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            Tümü
                        </button>

                        <div className="w-px h-6 bg-gray-200 flex-shrink-0"></div>

                        <div className="overflow-x-auto pb-2 -mb-2 flex-grow custom-scrollbar flex items-center">
                            <div className="flex space-x-2">
                                {neighborhoods.filter(n => n !== 'Tümü').map(mahalle => (
                                    <button
                                        key={mahalle}
                                        onClick={() => setSelectedNeighborhood(mahalle)}
                                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${selectedNeighborhood === mahalle
                                            ? 'bg-orange-600 border-orange-500 text-white shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        {mahalle}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="p-4 w-24 text-center">GÖRSEL</th>
                                <th className="p-4">BAŞLIK</th>
                                <th className="p-4">KATEGORİ</th>
                                <th className="p-4">FİYAT</th>
                                <th className="p-4">KONUM</th>
                                {user?.role === 'admin' && <th className="p-4">EKLEYEN</th>}
                                <th className="p-4">TARİH</th>
                                <th className="p-4 w-24 text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRecords.map((record) => (
                                <React.Fragment key={record.id}>
                                    <tr
                                        onClick={() => toggleExpand(record.id)}
                                        className={`cursor-pointer transition-colors group ${expandedRecordId === record.id ? 'bg-orange-50/70' : 'hover:bg-orange-50/30'}`}
                                    >
                                        <td className="p-4 text-center">
                                            {record.images && record.images[0] ? (
                                                <img src={record.images[0]} alt="" className="w-16 h-12 object-cover rounded-md border border-gray-200 mx-auto" />
                                            ) : (
                                                <div className="w-16 h-12 bg-gray-100 rounded-md border border-gray-200 mx-auto flex items-center justify-center text-xs text-gray-400">Yok</div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-gray-900 line-clamp-2">{record.title}</div>
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
                                        <td className="p-4 font-bold text-orange-600 whitespace-nowrap">
                                            {record.price}
                                        </td>
                                        <td className="p-4 text-gray-600 text-sm">
                                            {record.location && record.location.includes('/') 
                                                ? record.location.split('/').pop().trim() 
                                                : record.location}
                                        </td>
                                        {user?.role === 'admin' && (
                                            <td className="p-4 text-gray-800 text-sm font-medium">
                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs whitespace-nowrap inline-block">{record.displayName || record.username || 'Bilinmiyor'}</span>
                                            </td>
                                        )}
                                        <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                                            {new Date(record.scrapedAt).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button className="text-gray-400">
                                                <svg className={`w-5 h-5 transform transition-transform ${expandedRecordId === record.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedRecordId === record.id && (
                                        <tr className="bg-gray-50/50 animate-fade-in relative z-10 w-full">
                                            <td colSpan={user?.role === 'admin' ? "8" : "7"} className="p-0 border-b border-gray-100" style={{ maxWidth: 0 }}>
                                                <div className="p-6 w-full mx-auto">

                                                    {/* Approval Action Form */}
                                                    <div className="bg-white border-2 border-orange-100 rounded-xl p-5 mb-6 shadow-sm flex flex-col md:flex-row gap-6">
                                                        <div className="flex-1">
                                                            <label className="block text-sm font-bold text-gray-700 mb-2">Not Ekle (İsteğe Bağlı)</label>
                                                            <textarea
                                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors resize-none"
                                                                rows="3"
                                                                placeholder="Bu ilanla ilgili kendinize bir not bırakın..."
                                                                value={approvalNotes[record.id] || ''}
                                                                onChange={(e) => setApprovalNotes({ ...approvalNotes, [record.id]: e.target.value })}
                                                                onClick={(e) => e.stopPropagation()}
                                                            ></textarea>
                                                        </div>
                                                        <div className="flex flex-col justify-between w-full md:w-64">
                                                            <div>
                                                                <label className="block text-sm font-bold text-gray-700 mb-2">Durum Etiketi</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                                                                    placeholder="Örn: Arandı, Düşünülecek"
                                                                    value={approvalStatuses[record.id] || ''}
                                                                    onChange={(e) => setApprovalStatuses({ ...approvalStatuses, [record.id]: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            <div className="flex gap-2 mt-4 flex-col">
                                                                <button
                                                                    onClick={(e) => handleOpenDemandModal(e, record)}
                                                                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 px-4 rounded-lg border border-indigo-200 transition-colors flex items-center justify-center gap-2 mb-1 shadow-sm"
                                                                >
                                                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                                                    Talebe Ekle
                                                                </button>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={(e) => handleDeleteRecord(e, record.id)}
                                                                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 px-2 rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1 shadow-sm"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                        Sil
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => handleApproveRecord(e, record.id)}
                                                                        className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-2 rounded-lg shadow transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                                        Onayla
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Record details */}
                                                    {record.images && record.images.length > 0 && (
                                                        <div className="mb-8 relative group max-w-full">
                                                            <div className="flex items-center justify-between mb-4 border-b border-gray-900 pb-3">
                                                                <h4 className="font-bold text-gray-900 text-lg">Görseller ({record.images.length})</h4>
                                                                <span className="text-xs text-gray-400 font-medium md:hidden">(Kaydırılabilir)</span>
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
                                                                        onClick={() => setGalleryData({ items: record.images, index: idx })}
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
                                                    <div className="grid md:grid-cols-2 gap-12 max-w-full">
                                                        <div>
                                                            <div className="flex items-center gap-2 border-b border-gray-900 pb-3 mb-6">
                                                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                                                <h4 className="font-bold text-gray-900 text-lg">Özellikler</h4>
                                                            </div>
                                                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                                                                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                                                    {record.properties && typeof record.properties === 'object' && Object.entries(record.properties).map(([key, value]) => (
                                                                        <div key={key} className="flex flex-col">
                                                                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">{key}</span>
                                                                            <span className="font-bold text-gray-800 text-sm break-words leading-snug">{value}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 border-b border-gray-900 pb-3 mb-6">
                                                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                                                                <h4 className="font-bold text-gray-900 text-lg">Açıklama Özeti</h4>
                                                            </div>
                                                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-[calc(100%-4rem)] max-w-full overflow-hidden">
                                                                <div
                                                                    className="text-sm text-gray-600 font-medium leading-relaxed max-h-[400px] overflow-y-auto overflow-x-hidden pr-3 custom-scrollbar break-words"
                                                                    dangerouslySetInnerHTML={{ __html: record.description || '' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                        <div className="relative w-16 h-16 mb-4">
                            <svg className="w-full h-full animate-[spin_2s_linear_infinite]" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#ffedd5" strokeWidth="8" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#f97316" strokeWidth="8" strokeLinecap="round" strokeDasharray="283" strokeDashoffset="70" className="opacity-90 animate-[pulse_1.5s_ease-in-out_infinite]" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                        </div>
                        <p className="text-gray-500 font-medium text-sm animate-pulse">Bekleyen İlanlar Yükleniyor...</p>
                    </div>
                ) : sortedRecords.length === 0 && (
                    <div className="p-16 text-center">
                        <div className="text-gray-300 mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">İlan Bulunamadı</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Seçtiğiniz filtrelere uygun onay bekleyen ilan bulunmamaktadır.
                        </p>
                    </div>
                )}
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Toplam <span className="font-bold text-gray-900">{sortedRecords.length}</span> kayıttan <span className="font-bold text-gray-900">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedRecords.length)}</span> arası gösteriliyor
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    // Show first, last, and pages around current
                                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${currentPage === pageNum ? 'bg-orange-600 text-white shadow-md shadow-orange-100' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                        return <span key={pageNum} className="text-gray-400">...</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </div>
                )}
                {/* Demand Selection Modal */}
                {showDemandModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDemandModal(false)}></div>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">

                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                        Müşteri Talebiyle Eşleştir
                                    </h3>
                                    <p className="text-xs text-indigo-600 mt-1 line-clamp-1 opacity-70">
                                        Seçilen İlan: <strong>{selectedListingForDemand?.title}</strong>
                                    </p>
                                </div>
                                <button onClick={() => setShowDemandModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar bg-gray-50/50">
                                {demands.length === 0 ? (
                                    <div className="text-center p-8 bg-white rounded-xl border border-dashed border-gray-200 m-4">
                                        <p className="text-gray-500 font-medium">Aktif müşteri talebiniz bulunmuyor.</p>
                                        <button
                                            onClick={() => navigate('/sayfalar/talepler')}
                                            className="mt-3 text-indigo-600 font-bold text-sm hover:underline"
                                        >
                                            Yeni Talep Oluştur →
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 p-2 relative">
                                        {matchingDemand && (
                                            <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                        {demands.map(demand => (
                                            <div
                                                key={demand.id}
                                                onClick={() => !matchingDemand && handleMatchToDemand(demand.id)}
                                                className={`bg-white border rounded-xl p-4 flex justify-between items-center transition-all ${matchingDemand ? 'opacity-50 pointer-events-none' : 'hover:border-indigo-300 hover:shadow-md cursor-pointer border-gray-200'}`}
                                            >
                                                <div>
                                                    <h4 className="font-bold text-gray-900 group-hover:text-indigo-700">{demand.clientName}</h4>
                                                    <div className="flex gap-2 mt-1.5 opacity-80">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                            {demand.demandType}
                                                        </span>
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${demand.transactionType === 'Satılık' ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'}`}>
                                                            {demand.transactionType}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-widest">Bütçe</span>
                                                    <span className="font-bold text-gray-700 text-sm">
                                                        {demand.details?.maxPrice ? `${Number(demand.details.maxPrice).toLocaleString('tr-TR')} TL` : 'Belirtilmedi'}
                                                    </span>
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
        </div>
    );
}

export default PendingListings;
