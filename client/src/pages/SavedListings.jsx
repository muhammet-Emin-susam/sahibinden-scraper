import React, { useState, useEffect, useContext } from 'react';
import * as XLSX from 'xlsx-js-style';
import { AuthContext } from '../contexts/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { tr } from 'date-fns/locale';
import { API_BASE_URL } from '../config';


function SavedListings() {
    const [savedRecords, setSavedRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRecordId, setExpandedRecordId] = useState(null);
    const [archivingId, setArchivingId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [activityLogs, setActivityLogs] = useState({}); // { [recordId]: [...logs] }

    // Archive Modal states
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [recordToArchive, setRecordToArchive] = useState(null);
    const [archiveFolders, setArchiveFolders] = useState([]);
    const [selectedFolderId, setSelectedFolderId] = useState("");
    const [newFolderName, setNewFolderName] = useState("");
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Collection Modal states
    const [collections, setCollections] = useState([]);
    const [showCollectionModal, setShowCollectionModal] = useState(false);
    const [recordToCollect, setRecordToCollect] = useState(null);
    const [selectedCollectionIds, setSelectedCollectionIds] = useState([]);
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState("");
    const [collectingId, setCollectingId] = useState(null);

    // Demand Match states
    const [showDemandModal, setShowDemandModal] = useState(false);
    const [demands, setDemands] = useState([]);
    const [selectedListingForDemand, setSelectedListingForDemand] = useState(null);
    const [matchingDemand, setMatchingDemand] = useState(false);

    // Export Modal states
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState('portfoy');

    // Editing states
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editNoteValue, setEditNoteValue] = useState("");
    const [editingStatusId, setEditingStatusId] = useState(null);
    const [editStatusValue, setEditStatusValue] = useState("");

    // Advanced Filtering states
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showPortfolioOnly, setShowPortfolioOnly] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [sortBy, setSortBy] = useState('newest_approved');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const { token, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    // Check for auto-expand request from navigation state
    useEffect(() => {
        if (location.state?.expandRecordId && savedRecords.length > 0) {
            const targetId = location.state.expandRecordId;
            setExpandedRecordId(targetId);

            // Calculate which page this record is on (assuming default sort and no active filters)
            const index = savedRecords.findIndex(r => r.id === targetId);
            if (index !== -1) {
                const targetPage = Math.floor(index / itemsPerPage) + 1;
                setCurrentPage(targetPage);

                // Scroll into view after render
                setTimeout(() => {
                    const row = document.getElementById(`record-${targetId}`);
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 150);
            }

            // Clear the state so it doesn't re-trigger
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, savedRecords, navigate]);

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
                // Sadece approved (onaylanmış) ve matched (eşleştirilmiş) kayıtları göster
                const approvedRecords = result.data.filter(r => r.status === 'approved' || r.status === 'matched');
                setSavedRecords(approvedRecords);
            } else if (response.status === 401 || response.status === 403) {
                logout();
                navigate('/login');
            }
        } catch (err) {
            console.error('Failed to fetch records:', err);
        }
    };

    const togglePortfolio = async (id, currentStatus) => {
        try {
            const res = await fetch(`${API_BASE_URL}/records/${id}/portfolio`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isPortfolio: !currentStatus })
            });
            const data = await res.json();
            if (data.success) {
                setSavedRecords(prev => prev.map(r => r.id === id ? { ...r, isPortfolio: !currentStatus } : r));
            }
        } catch (err) {
            console.error('Portfolio toggle hata:', err);
        }
    };

    const fetchArchiveFolders = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/archive-folders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setArchiveFolders(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch archive folders:', err);
        }
    };

    const fetchCollections = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/collections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setCollections(result.data);
            }
        } catch (err) {
            console.error('Failed to fetch collections:', err);
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

    useEffect(() => {
        const initFetch = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchRecords(),
                fetchArchiveFolders(),
                fetchCollections()
            ]);
            setIsLoading(false);
        };
        initFetch();
        const interval = setInterval(fetchRecords, 5000);
        return () => clearInterval(interval);
    }, [token]);

    const handleDeleteRecord = async (e, id) => {
        e.stopPropagation();

        try {
            await fetch(`${API_BASE_URL}/records/${id}`, {
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

            const response = await fetch(`${API_BASE_URL}/records/${id}/update`, {
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

    const handleArchiveRecord = (e, record) => {
        e.stopPropagation();
        setRecordToArchive(record);
        if (archiveFolders.length > 0) {
            setSelectedFolderId(archiveFolders[0].id);
        } else {
            setSelectedFolderId("");
        }
        setNewFolderName("");
        setIsCreatingFolder(false);
        setShowArchiveModal(true);
    };

    const confirmArchive = async () => {
        if (!recordToArchive) return;

        setArchivingId(recordToArchive.id);

        let targetFolderId = selectedFolderId;

        // If creating a new folder
        if (isCreatingFolder && newFolderName.trim()) {
            try {
                const folderRes = await fetch(`${API_BASE_URL}/archive-folders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: newFolderName.trim() })
                });
                const folderResult = await folderRes.json();
                if (folderResult.success) {
                    targetFolderId = folderResult.data.id;
                    setArchiveFolders(prev => [...prev, folderResult.data]);
                } else {
                    console.error('Failed to create folder:', folderResult.error);
                    setArchivingId(null);
                    return; // Stop if folder creation fails
                }
            } catch (err) {
                console.error('Failed to create folder:', err);
                setArchivingId(null);
                return;
            }
        }

        try {
            const response = await fetch(`${API_BASE_URL}/records/${recordToArchive.id}/archive`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ folderId: targetFolderId || null })
            });
            const result = await response.json();
            if (result.success) {
                setSavedRecords(prev => prev.filter(reqRecord => reqRecord.id !== recordToArchive.id));
                setShowArchiveModal(false);
                setRecordToArchive(null);
            }
        } catch (err) {
            console.error('Failed to archive:', err);
        } finally {
            setArchivingId(null);
        }
    };

    const handleCollectRecord = (e, record) => {
        e.stopPropagation();
        setRecordToCollect(record);
        setSelectedCollectionIds(record.collections || []); // Load existing collections
        setNewCollectionName("");
        setIsCreatingCollection(false);
        setShowCollectionModal(true);
    };

    const toggleCollectionCheckbox = (id) => {
        setSelectedCollectionIds(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleCreateCollection = async () => {
        if (!newCollectionName.trim()) return;
        try {
            const res = await fetch(`${API_BASE_URL}/collections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newCollectionName.trim() })
            });
            const result = await res.json();
            if (result.success) {
                setCollections(prev => [...prev, result.data]);
                setSelectedCollectionIds(prev => [...prev, result.data.id]);
                setNewCollectionName("");
                setIsCreatingCollection(false);
            }
        } catch (err) {
            console.error('Failed to create collection:', err);
        }
    };

    const confirmCollectionSave = async () => {
        if (!recordToCollect) return;
        setCollectingId(recordToCollect.id);

        try {
            const response = await fetch(`${API_BASE_URL}/records/${recordToCollect.id}/collections`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ collectionIds: selectedCollectionIds })
            });
            const result = await response.json();
            if (result.success) {
                setShowCollectionModal(false);
                setSavedRecords(prev => prev.map(r => r.id === recordToCollect.id ? { ...r, collections: selectedCollectionIds } : r));
                setRecordToCollect(null);
            }
        } catch (err) {
            console.error('Failed to update collections:', err);
        } finally {
            setCollectingId(null);
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
                    city: selectedListingForDemand.city || '',
                    district: selectedListingForDemand.district || '',
                    neighborhood: selectedListingForDemand.neighborhood || ''
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
                setShowDemandModal(false);
                fetchRecords(); // Update status of matched record
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error('Failed to match demand:', err);
            alert('Talebe ekleme başarısız oldu.');
        } finally {
            setMatchingDemand(false);
        }
    };

    const toggleExpand = async (id) => {
        const newId = expandedRecordId === id ? null : id;
        setExpandedRecordId(newId);
        // Fetch activity when opening
        if (newId && !activityLogs[newId]) {
            try {
                const res = await fetch(`${API_BASE_URL}/records/${newId}/activity`, {
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
        // Scroll to top of the table container when page changes
        const mainContainer = document.querySelector('main > div.overflow-y-auto');
        if (mainContainer) {
            mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentPage]);

    const mainCategories = ['Tümü', 'Satılık', 'Kiralık', 'Günlük Kiralık', 'Devren Satılık', 'Devren Kiralık', 'Kat Karşılığı', 'Diğer'];
    const subCategories = ['Tümü', 'Konut', 'İş Yeri', 'Arsa', 'Tarla', 'Bahçe', 'Bağ', 'Zeytinlik', 'Bina', 'Devre Mülk', 'Turistik Tesis', 'Diğer'];

    const neighborhoods = ['Tümü', ...new Set(savedRecords.map(r => {
        if (!r.location) return 'Diğer';
        const parts = String(r.location).split('/');
        return parts.length >= 3 ? parts[2].trim() : 'Diğer';
    }))].sort();

    // Extract unique user objects for the filter dropdown
    const uniqueUsers = [...new Map(savedRecords.map(r => [
        r.username || 'Bilinmiyor',
        { username: r.username || 'Bilinmiyor', displayName: String(r.displayName || r.username || 'Bilinmiyor') }
    ])).values()].sort((a, b) => a.displayName.localeCompare(b.displayName));

    const filteredRecords = savedRecords.filter(r => {
        if (showPortfolioOnly && !r.isPortfolio) return false;

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

        // Advanced Filters
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
            // Price cleaning function (e.g. "1.500.000 TL" -> 1500000)
            const cleanPriceStr = (pStr) => {
                if (!pStr) return 0;
                // Remove everything except numbers
                let numericStr = String(pStr).replace(/[^0-9]/g, '');
                return numericStr ? parseInt(numericStr, 10) : 0;
            };

            const recordPrice = cleanPriceStr(r.price);
            const minP = minPrice ? parseInt(minPrice, 10) : 0;
            const maxP = maxPrice ? parseInt(maxPrice, 10) : Infinity;

            if (minPrice && maxPrice) {
                priceMatch = recordPrice >= minP && recordPrice <= maxP;
            } else if (minPrice) {
                priceMatch = recordPrice >= minP;
            } else if (maxPrice) {
                priceMatch = recordPrice <= maxP;
            }
        }

        let dateMatch = true;
        if (startDate || endDate) {
            const recordDate = new Date(r.scrapedAt);
            recordDate.setHours(0, 0, 0, 0);

            let sDate = startDate ? new Date(startDate) : null;
            if (sDate) sDate.setHours(0, 0, 0, 0);

            let eDate = endDate ? new Date(endDate) : null;
            if (eDate) eDate.setHours(23, 59, 59, 999);

            if (startDate && endDate) {
                dateMatch = recordDate >= sDate && recordDate <= eDate;
            } else if (startDate) {
                dateMatch = recordDate >= sDate;
            } else if (endDate) {
                dateMatch = recordDate <= eDate;
            }
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
        setSortBy('newest_approved');
        setCurrentPage(1);
    };

    const sortedRecords = [...filteredRecords].sort((a, b) => {
        const cleanPrice = (pStr) => {
            if (!pStr) return 0;
            let numericStr = String(pStr).replace(/[^0-9]/g, '');
            return numericStr ? parseInt(numericStr, 10) : 0;
        };

        switch (sortBy) {
            case 'newest_approved':
                return new Date(b.approvedAt || b.scrapedAt) - new Date(a.approvedAt || a.scrapedAt);
            case 'oldest_approved':
                return new Date(a.approvedAt || a.scrapedAt) - new Date(b.approvedAt || b.scrapedAt);
            case 'newest_scraped':
                return new Date(b.scrapedAt) - new Date(a.scrapedAt);
            case 'oldest_scraped':
                return new Date(a.scrapedAt) - new Date(b.scrapedAt);
            case 'price_desc':
                return cleanPrice(b.price) - cleanPrice(a.price);
            case 'price_asc':
                return cleanPrice(a.price) - cleanPrice(b.price);
            default:
                return 0;
        }
    });

    // Pagination Calculations
    const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentRecords = sortedRecords.slice(indexOfFirstItem, indexOfLastItem);

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
                    const parts = String(record.location).split('/');
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
                    const parts = String(record.location).split('/').map(p => p.trim());
                    if (parts.length >= 1) sehir = parts[0];
                    if (parts.length >= 2) ilce = parts[1];
                    if (parts.length >= 3) mahalle = parts[2];
                }

                // Clean price for easier math if needed later, but retaining original string here since it's a preview
                return {
                    'İlan No': props['İlan No'] || '',
                    'Tarih': new Date(record.scrapedAt).toLocaleDateString('tr-TR'),
                    'Durum': record.status_tag || '',
                    'İşlem Tipi': record.mainCategory || '',
                    'Tür': record.subCategory || '',
                    'Şehir': sehir,
                    'İlçe': ilce,
                    'Mahalle': mahalle,
                    'Google Haritalar': record.mapUrl || '',
                    'Adres': record.location || '',
                    'M²': props['m² (Brüt)'] || props['m² (Net)'] || props['m²'] || props['Metrekare'] || '',
                    'Oda Sayısı': props['Oda Sayısı'] || '',
                    'Kat': props['Bulunduğu Kat'] || '',
                    'Bina Yaşı': props['Bina Yaşı'] || '',
                    'Isınma': props['Isıtma'] || '',
                    'Asansör': props['Asansör'] || '',
                    'Otopark': props['Otopark'] || '',
                    'İlan Fiyatı': record.price || '',
                    'M² Fiyatı': props['m² Fiyatı'] || '',
                    'Mal Sahibi': record.sellerName || '',
                    'Telefon': record.sellerPhone || '',
                    'Tapu Durumu': props['Tapu Durumu'] || '',
                    'Kredi Uygun': props['Krediye Uygunluk'] || '',
                    'Aidat': props['Aidat (TL)'] || '',
                    'Notlar': record.note || ''
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
            {/* Archive Modal */}
            {showArchiveModal && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-bold text-gray-900">Klasöre Arşivle</h3>
                            <button onClick={() => { setShowArchiveModal(false); setRecordToArchive(null); }} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                <span className="font-semibold text-gray-900">"{recordToArchive?.title}"</span> ilanını arşivliyorsunuz.
                            </p>

                            {!isCreatingFolder ? (
                                <>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Klasör Seçin:</label>
                                    <select
                                        value={selectedFolderId}
                                        onChange={(e) => setSelectedFolderId(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 p-3 outline-none"
                                    >
                                        <option value="">Genel (Klasörsüz)</option>
                                        {archiveFolders.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                        Yeni Klasör Oluştur
                                    </button>
                                </>
                            ) : (
                                <>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Yeni Klasör Adı:</label>
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Örn: Aciller, Favoriler..."
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 p-3 outline-none"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => setIsCreatingFolder(false)}
                                        className="mt-3 text-sm font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                        Klasör Seçimine Dön
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => { setShowArchiveModal(false); setRecordToArchive(null); }}
                                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmArchive}
                                disabled={archivingId === recordToArchive?.id || (isCreatingFolder && !newFolderName.trim())}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {archivingId === recordToArchive?.id ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                                )}
                                Arşive Taşı
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Collection Modal */}
            {showCollectionModal && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-bold text-gray-900">Koleksiyonlara Ekle</h3>
                            <button onClick={() => { setShowCollectionModal(false); setRecordToCollect(null); }} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                <span className="font-semibold text-gray-900">"{recordToCollect?.title}"</span> ilanını hangi koleksiyonlara eklemek istersiniz?
                            </p>

                            {!isCreatingCollection ? (
                                <>
                                    <div className="max-h-60 overflow-y-auto space-y-2 mb-4 p-1 custom-scrollbar">
                                        {collections.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                Henüz koleksiyonunuz yok.
                                            </div>
                                        ) : (
                                            collections.map(c => (
                                                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCollectionIds.includes(c.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedCollectionIds.includes(c.id)}
                                                        onChange={() => toggleCollectionCheckbox(c.id)}
                                                    />
                                                    <span className={`text-sm font-medium ${selectedCollectionIds.includes(c.id) ? 'text-indigo-900' : 'text-gray-700'}`}>{c.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.preventDefault(); setIsCreatingCollection(true); }}
                                        className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                        Yeni Koleksiyon Oluştur
                                    </button>
                                </>
                            ) : (
                                <>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Yeni Koleksiyon Adı:</label>
                                    <input
                                        type="text"
                                        value={newCollectionName}
                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                        placeholder="Örn: Ahmet Bey İçin, Yatırımlık..."
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/50 p-3 outline-none"
                                        autoFocus
                                    />
                                    <div className="flex justify-between items-center mt-3">
                                        <button
                                            onClick={(e) => { e.preventDefault(); setIsCreatingCollection(false); }}
                                            className="text-sm font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                            Geri Dön
                                        </button>
                                        <button
                                            onClick={handleCreateCollection}
                                            disabled={!newCollectionName.trim()}
                                            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                                        >
                                            Oluştur
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => { setShowCollectionModal(false); setRecordToCollect(null); }}
                                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmCollectionSave}
                                disabled={collectingId === recordToCollect?.id || isCreatingCollection}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {collectingId === recordToCollect?.id ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                )}
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowPortfolioOnly(!showPortfolioOnly)}
                            title={showPortfolioOnly ? "Tüm İlanları Göster" : "Portföyümü Göster"}
                            className={`group border font-semibold p-2 md:p-2.5 rounded-xl shadow-sm transition-all duration-700 ease-in-out flex items-center justify-center overflow-hidden max-w-[40px] md:max-w-[44px] hover:max-w-[200px] ${showPortfolioOnly ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <svg className={`w-5 h-5 flex-shrink-0 min-w-[20px] transition-transform duration-700 ease-in-out group-hover:scale-110 ${showPortfolioOnly ? 'text-white' : 'text-indigo-500 fill-transparent'}`} fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                            <span className="opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[150px] group-hover:ml-2 transition-all duration-700 ease-in-out whitespace-nowrap overflow-hidden text-sm">{showPortfolioOnly ? "Tümü" : "Portföyüm"}</span>
                        </button>
                        <button
                            onClick={fetchRecords}
                            title="Listeyi Yenile"
                            className="group bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 font-semibold p-2 md:p-2.5 rounded-xl shadow-sm transition-all duration-700 ease-in-out flex items-center justify-center overflow-hidden max-w-[40px] md:max-w-[44px] hover:max-w-[200px]"
                        >
                            <svg className="w-5 h-5 flex-shrink-0 min-w-[20px] transition-transform duration-700 ease-in-out group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span className="opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[100px] group-hover:ml-2 transition-all duration-700 ease-in-out whitespace-nowrap overflow-hidden text-sm">Yenile</span>
                        </button>
                        <button
                            onClick={() => setShowExportModal(true)}
                            disabled={savedRecords.length === 0}
                            title="Excel Olarak İndir"
                            className="group bg-green-600 hover:bg-green-700 text-white font-semibold p-2 md:p-2.5 rounded-xl shadow-sm transition-all duration-700 ease-in-out flex items-center justify-center overflow-hidden max-w-[40px] md:max-w-[44px] hover:max-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5 flex-shrink-0 min-w-[20px] transition-transform duration-700 ease-in-out group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span className="opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[100px] group-hover:ml-2 transition-all duration-700 ease-in-out whitespace-nowrap overflow-hidden text-sm">İndir</span>
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

                                <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Sıralama:</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-lg focus:ring-2 focus:ring-blue-500/50 block p-2 outline-none cursor-pointer transition-all hover:bg-gray-100 min-w-[160px]"
                                    >
                                        <option value="newest_approved">En Yeni Onaylanan</option>
                                        <option value="oldest_approved">En Eski Onaylanan</option>
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

                                {(selectedNeighborhood !== 'Tümü' || selectedMainCategory !== 'Tümü' || selectedSubCategory !== 'Tümü' || searchTerm || minPrice || maxPrice || startDate || endDate) && (
                                    <button
                                        onClick={resetFilters}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors ml-auto md:ml-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        Temizle
                                    </button>
                                )}
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
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
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
                                                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
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

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 max-lg:overflow-hidden lg:overflow-visible relative">
                            <div className="max-lg:overflow-x-auto lg:overflow-visible custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-bold tracking-widest">
                                            <th className="p-4 w-12 text-center lg:rounded-tl-3xl">P.Ö</th>
                                            <th className="p-4 w-24 text-center">GÖRSEL</th>
                                            <th className="p-4">BAŞLIK</th>
                                            <th className="p-4">KATEGORİ</th>
                                            <th className="p-4">FİYAT</th>
                                            <th className="p-4">KONUM</th>
                                            <th className="p-4">DURUM</th>
                                            {user?.role === 'admin' && <th className="p-4">EKLEYEN</th>}
                                            <th className="p-4">TARİH</th>
                                            <th className="p-4 w-24 text-right lg:rounded-tr-3xl">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {currentRecords.map((record, index) => (
                                            <React.Fragment key={record.id}>
                                                <tr
                                                    id={`record-${record.id}`}
                                                    onClick={() => toggleExpand(record.id)}
                                                    className={`cursor-pointer transition-colors group relative ${expandedRecordId === record.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="p-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                                                        {/* Row Number Outside - Centered Vertically */}
                                                        <div className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 flex items-center pr-4 pointer-events-none select-none">
                                                            <span className="text-[16px] font-black text-gray-400 opacity-0 group-hover:opacity-100 lg:opacity-50 transition-opacity">
                                                                {(currentPage - 1) * itemsPerPage + index + 1}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => togglePortfolio(record.id, record.isPortfolio)}
                                                            className={`p-1.5 rounded-lg transition-colors focus:outline-none ${record.isPortfolio ? 'text-indigo-500 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-300 hover:text-indigo-400 hover:bg-gray-50'}`}
                                                            title={record.isPortfolio ? "Portföyden Çıkar" : "Portföye Al"}
                                                        >
                                                            <svg className="w-6 h-6" fill={record.isPortfolio ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                                                        </button>
                                                    </td>
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
                                                        {(record.sellerName || record.sellerPhone || record.officeName) && (
                                                            <div className="text-[11px] text-gray-500 mt-1.5 space-y-0.5 bg-gray-50 p-1.5 rounded border border-gray-100 w-max pr-4">
                                                                {record.sellerName && <div className="flex items-center gap-1.5"><svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {record.sellerName}</div>}
                                                                {record.sellerPhone && <div className="flex items-center gap-1.5"><svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {record.sellerPhone}</div>}
                                                                {record.officeName ? (
                                                                    <div className="flex items-center gap-1.5 pt-0.5 mt-0.5 border-t border-gray-200/60 font-medium text-gray-400">
                                                                        {record.officeLogo ? (
                                                                            <img src={record.officeLogo} alt="" className="w-4 h-4 object-contain rounded-sm" />
                                                                        ) : (
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                                        )}
                                                                        <span className="truncate max-w-[120px]" title={record.officeName}>{record.officeName}</span>
                                                                    </div>
                                                                ) : record.isOffice && (
                                                                    <div className="flex items-center gap-1.5 pt-0.5 mt-0.5 border-t border-gray-200/60 font-medium text-indigo-400/80 italic">
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                                        <span>Emlak Ofisinden</span>
                                                                    </div>
                                                                )}
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
                                                                            String(record.mainCategory || '').includes('Devren') ? 'bg-amber-100 text-amber-700' :
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
                                                                    <option value="Geri Dönüş Bekleniyor">Geri Dönüş Bekleniyor</option>
                                                                    <option value="Müşteriyle Görüşüldü">Müşteriyle Görüşüldü</option>
                                                                    <option value="Randevu Alındı">Randevu Alındı</option>
                                                                    <option value="Teklif Verildi">Teklif Verildi</option>
                                                                    <option value="Kapora Alındı">Kapora Alındı</option>
                                                                    <option value="Satıldı">Satıldı</option>
                                                                    <option value="Kiralandı">Kiralandı</option>
                                                                     <option value="Sözleşme İmzalandı">Sözleşme İmzalandı</option>
                                                                    <option value="Başka Emlakçıyla Çalışıyor">Başka Emlakçıyla Çalışıyor</option>
                                                                    <option value="Vazgeçildi">Vazgeçildi</option>
                                                                    <option value="İlgilenmiyor">İlgilenmiyor</option>
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
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${record.status_tag === 'Aranacak' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                                    record.status_tag === 'Arandı' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                                        record.status_tag === 'Ulaşılamadı' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                                                                            record.status_tag === 'Geri Dönüş Bekleniyor' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' :
                                                                                record.status_tag === 'Müşteriyle Görüşüldü' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                                                                                    record.status_tag === 'Randevu Alındı' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                                                        record.status_tag === 'Teklif Verildi' ? 'bg-violet-100 text-violet-800 border border-violet-200' :
                                                                                            record.status_tag === 'Kapora Alındı' ? 'bg-lime-100 text-lime-800 border border-lime-200' :
                                                                                                record.status_tag === 'Sözleşme İmzalandı' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                                                                                                    record.status_tag === 'Başka Emlakçıyla Çalışıyor' ? 'bg-slate-100 text-slate-800 border border-slate-200' :
                                                                                                        record.status_tag === 'Vazgeçildi' ? 'bg-zinc-100 text-zinc-800 border border-zinc-200' :
                                                                                                            record.status_tag === 'Satıldı' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                                                                                        record.status_tag === 'Kiralandı' ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200' :
                                                                                                            record.status_tag === 'İlgilenmiyor' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                                                                                                record.status_tag === 'İptal' ? 'bg-red-100 text-red-800 border border-red-200' :
                                                                                                                    'bg-gray-50 text-gray-600 border border-gray-200'
                                                                    }`}>
                                                                    {record.status_tag || 'Durum Yok'}
                                                                </span>
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingStatusId(record.id); setEditStatusValue(record.status_tag || ''); }} className="opacity-0 group-hover/status:opacity-100 text-gray-400 hover:text-blue-600 p-1 transition-all rounded" title="Durumu Güncelle">
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
                                                    <td className="p-4 text-right relative">
                                                        <div className="flex items-center justify-end gap-2 pr-2">
                                                            <button
                                                                onClick={(e) => handleDeleteRecord(e, record.id)}
                                                                className="text-gray-400 hover:text-red-500 p-1.5 transition-colors rounded-md hover:bg-red-50"
                                                                title="Sil"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                            </button>
                                                            <button className="text-gray-400 ml-1">
                                                                <svg className={`w-5 h-5 transform transition-transform ${expandedRecordId === record.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                            </button>
                                                        </div>
                                                        {/* ACTION BUTTONS WRAPPER - ABSOLUTE OUTSIDE */}
                                                        <div className="absolute inset-y-0 -right-36 md:-right-48 w-36 md:w-48 flex items-center justify-center gap-1 md:gap-2 z-50">
                                                            <button
                                                                onClick={(e) => handleOpenDemandModal(e, record)}
                                                                className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 transition-all duration-300 rounded-full text-gray-400 hover:text-indigo-600 hover:scale-110 hover:bg-black/5 cursor-pointer ${expandedRecordId === record.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                                title="Talebe Ekle"
                                                            >
                                                                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleCollectRecord(e, record)}
                                                                disabled={collectingId === record.id}
                                                                className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 transition-all duration-300 rounded-full ${collectingId === record.id ? 'text-indigo-500 opacity-100 cursor-wait' : 'text-gray-400 hover:text-indigo-600 hover:scale-110 hover:bg-black/5 cursor-pointer'} ${expandedRecordId === record.id || collectingId === record.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                                title="Koleksiyona Ekle"
                                                            >
                                                                {collectingId === record.id ? (
                                                                    <svg className="w-4 h-4 md:w-5 md:h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleArchiveRecord(e, record)}
                                                                disabled={archivingId === record.id}
                                                                className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 transition-all duration-300 rounded-full ${archivingId === record.id ? 'text-amber-500 opacity-100 cursor-wait' : 'text-gray-400 hover:text-amber-600 hover:scale-110 hover:bg-black/5 cursor-pointer'} ${expandedRecordId === record.id || archivingId === record.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                                title="İlanı Arşivle"
                                                            >
                                                                {archivingId === record.id ? (
                                                                    <svg className="w-4 h-4 md:w-5 md:h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedRecordId === record.id && (
                                                    <tr className="bg-gray-50/50 animate-fade-in relative z-10 w-full">
                                                        <td colSpan={user?.role === 'admin' ? "10" : "9"} className="p-0 border-b border-gray-100" style={{ maxWidth: 0 }}>
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
                                                                {Array.isArray(record.images) && record.images.length > 0 && (
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

                                                                {/* Activity Timeline */}
                                                                {(() => {
                                                                    const logs = activityLogs[record.id];
                                                                    const actionLabel = (a) => {
                                                                        const action = String(a || '').toLowerCase();
                                                                        const labels = {
                                                                            listing_added: { icon: '➕', text: 'İlan eklendi', color: 'text-green-600 bg-green-50 border-green-200' },
                                                                            listing_deleted: { icon: '🗑️', text: 'İlan silindi', color: 'text-red-600 bg-red-50 border-red-200' },
                                                                            soft_deleted: { icon: '🗑️', text: 'Çöpe taşındı', color: 'text-orange-600 bg-orange-50 border-orange-200' },
                                                                            hard_deleted: { icon: '💥', text: 'Kalıcı silindi', color: 'text-red-700 bg-red-100 border-red-300' },
                                                                            restored: { icon: '♻️', text: 'Geri alındı', color: 'text-teal-600 bg-teal-50 border-teal-200' },
                                                                            status_changed: { icon: '🔄', text: 'Durum değişti', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                                                                            status_tag_changed: { icon: '🏷️', text: 'Etiket değişti', color: 'text-purple-600 bg-purple-50 border-purple-200' },
                                                                            note_changed: { icon: '📝', text: 'Not güncellendi', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                                                                            demand_created: { icon: '📋', text: 'Talep oluşturuldu', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                                                                            demand_deleted: { icon: '❌', text: 'Talep silindi', color: 'text-gray-600 bg-gray-50 border-gray-200' },
                                                                            matched_to_demand: { icon: '🤝', text: 'Talebe eşleştirildi', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                                                                            query: { icon: '🔍', text: 'Sorgu yapıldı', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
                                                                            ai_analyzed: { icon: '✨', text: 'AI analizi yapıldı', color: 'text-purple-600 bg-purple-50 border-purple-200' },
                                                                            appointment_added: { icon: '📅', text: 'Randevu eklendi', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                                                                            appointment_deleted: { icon: '❌', text: 'Randevu silindi', color: 'text-red-600 bg-red-50 border-red-200' },
                                                                            appointment_updated: { icon: '🔄', text: 'Randevu güncellendi', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                                                                            removed_from_portfolio: { icon: '📤', text: 'Portföyden çıkarıldı', color: 'text-orange-600 bg-orange-50 border-orange-200' },
                                                                            added_to_portfolio: { icon: '📥', text: 'Portföye eklendi', color: 'text-green-600 bg-green-50 border-green-200' },
                                                                            archived: { icon: '📦', text: 'Arşivlendi', color: 'text-gray-600 bg-gray-50 border-gray-200' },
                                                                            unarchived: { icon: '🔓', text: 'Arşivden çıkarıldı', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                                                                            unmatched_from_demand: { icon: '💔', text: 'Talepten çıkarıldı', color: 'text-rose-600 bg-rose-50 border-rose-200' },
                                                                        };
                                                                        return labels[action] || { icon: '•', text: action.toUpperCase(), color: 'text-gray-600 bg-gray-50 border-gray-200' };
                                                                    };

                                                                    const translateStatus = (val) => {
                                                                        if (!val) return '(boş)';
                                                                        const s = String(val).toLowerCase();
                                                                        const map = {
                                                                            'approved': 'Onaylı',
                                                                            'pending': 'Onay Bekliyor',
                                                                            'deleted': 'Çöp Kutusu',
                                                                            'matched': 'Eşleştirildi',
                                                                            'archived': 'Arşivlendi',
                                                                            'tkgm': 'TKGM Kayıtları',
                                                                            'ai_analyzed': 'AI Analizli'
                                                                        };
                                                                        return map[s] || val;
                                                                    };

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
                                                                                                        <span className="line-through">{translateStatus(log.from)}</span>
                                                                                                        {' → '}
                                                                                                        <span className="font-medium text-gray-600">{translateStatus(log.to)}</span>
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
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                                    <div className="relative w-16 h-16 mb-4">
                                        <svg className="w-full h-full animate-[spin_2s_linear_infinite]" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e7ff" strokeWidth="8" />
                                            <circle cx="50" cy="50" r="45" fill="none" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" strokeDasharray="283" strokeDashoffset="70" className="opacity-90 animate-[pulse_1.5s_ease-in-out_infinite]" />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-indigo-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm animate-pulse">İlanlar Yükleniyor...</p>
                                </div>
                            ) : savedRecords.length === 0 && (
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

                        {/* Pagination Controls */}
                        {filteredRecords.length > 0 && totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-2xl shadow-sm">
                                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm text-gray-700">
                                            Toplam <span className="font-medium text-gray-900">{filteredRecords.length}</span> kayıttan{' '}
                                            <span className="font-medium text-gray-900">{indexOfFirstItem + 1}</span> -{' '}
                                            <span className="font-medium text-gray-900">{Math.min(indexOfLastItem, filteredRecords.length)}</span> arası gösteriliyor
                                        </p>
                                    </div>
                                    <div>
                                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <span className="sr-only">Önceki</span>
                                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                                </svg>
                                            </button>

                                            <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                                                Sayfa {currentPage} / {totalPages}
                                            </span>

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <span className="sr-only">Sonraki</span>
                                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                                <div className="flex flex-1 items-center justify-between sm:hidden">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Önceki
                                    </button>
                                    <span className="text-sm text-gray-700">Sayfa {currentPage} / {totalPages}</span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Sonraki
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

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
    );
}

export default SavedListings;
