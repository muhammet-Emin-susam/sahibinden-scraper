import { useState, useEffect, useContext, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { AuthContext } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import ExcelImportModal from '../components/ExcelImportModal';
import ExcelJS from 'exceljs';

const ExcelLists = () => {
    const { showToast, showAlert, showConfirm } = useNotification();
    const { token } = useContext(AuthContext);
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedWorkbook, setSelectedWorkbook] = useState(null);
    const [isFullView, setIsFullView] = useState(false);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [status, setStatus] = useState(null);
    // Finder UI States
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'recent', 'favorites', 'trash'
    const [searchQuery, setSearchQuery] = useState('');

    // Advanced Excel States
    const [focusedCell, setFocusedCell] = useState(null); // { r, c, header }
    const [selection, setSelection] = useState({ start: null, end: null, active: false });
    const [styleScope, setStyleScope] = useState('cell'); // 'cell', 'row', 'column', 'range'
    const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false, r: null, c: null, header: null });
    
    const tableRef = useRef(null);

    const filteredLists = lists.filter(list => {
        if (activeTab === 'trash') return list.isTrashed;
        if (list.isTrashed && activeTab !== 'trash') return false;
        
        if (activeTab === 'favorites' && !list.isFavorite) return false;
        
        if (searchQuery) return list.listName.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
    }).sort((a, b) => {
        if (activeTab === 'recent') {
            return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        }
        return 0; // Default uses server sorting (createdAt DESC)
    });

    const displayLists = activeTab === 'recent' && !searchQuery ? filteredLists.slice(0, 15) : filteredLists;


    useEffect(() => {
        fetchLists();
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClickOutside = (e) => {
        if (!e.target.closest('.context-menu')) {
            setContextMenu(prev => ({ ...prev, visible: false }));
        }
    };

    const fetchLists = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/excel-lists`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setLists(data.data);
            }
        } catch (err) {
            console.error('Error fetching excel lists:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (workbookData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/excel-lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(workbookData)
            });
            const data = await response.json();
            if (data.success) {
                showToast('Dosya başarıyla kaydedildi.', 'success');
                fetchLists();
                setShowImportModal(false);
            }
        } catch (err) {
            showAlert('Hata', 'Sunucuyla bağlantı kurulamadı.');
        }
    };

    const handleDelete = async (id) => {
        if (!(await showConfirm('Belgeyi Kapat', 'Bu dosyayı kalıcı olarak silmek istediğinize emin misiniz?'))) return;
        try {
            await fetch(`${API_BASE_URL}/excel-lists/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchLists();
            if (selectedWorkbook?.id === id) setSelectedWorkbook(null);
            setContextMenu(prev => ({...prev, visible: false}));
            showToast('Dosya başarıyla silindi.', 'success');
        } catch (err) {
            console.error('Error deleting list:', err);
            showAlert('Hata', 'Silme işlemi başarısız oldu.');
        }
    };

    const toggleFavorite = async (id) => {
        const list = lists.find(l => l.id === id);
        if (!list) return;
        const updated = { ...list, isFavorite: !list.isFavorite };
        setLists(lists.map(l => l.id === id ? updated : l));
        setContextMenu(prev => ({...prev, visible: false}));
        await debouncedSave(updated);
    };

    const moveToTrash = async (id) => {
        const list = lists.find(l => l.id === id);
        if (!list) return;
        const updated = { ...list, isTrashed: true };
        setLists(lists.map(l => l.id === id ? updated : l));
        if (selectedWorkbook?.id === id) setSelectedWorkbook(null);
        setContextMenu(prev => ({...prev, visible: false}));
        await debouncedSave(updated);
    };

    const restoreFromTrash = async (id) => {
        const list = lists.find(l => l.id === id);
        if (!list) return;
        const updated = { ...list, isTrashed: false };
        setLists(lists.map(l => l.id === id ? updated : l));
        setContextMenu(prev => ({...prev, visible: false}));
        await debouncedSave(updated);
    };

    const handleUpdateListValue = async (rowIndex, header, value) => {
        if (!selectedWorkbook) return;
        const updatedWorkbook = { ...selectedWorkbook };
        const sheet = updatedWorkbook.isWorkbook && updatedWorkbook.sheets 
            ? updatedWorkbook.sheets[activeSheetIndex] 
            : updatedWorkbook;
        sheet.data[rowIndex][header] = value;
        setSelectedWorkbook({ ...updatedWorkbook });
        debouncedSave(updatedWorkbook);
    };

    const handleApplyStyle = (styleType, value) => {
        if (!selectedWorkbook || !focusedCell) return;
        const updatedWorkbook = { ...selectedWorkbook };
        const sheet = updatedWorkbook.isWorkbook && updatedWorkbook.sheets 
            ? updatedWorkbook.sheets[activeSheetIndex] 
            : updatedWorkbook;

        const applyToCell = (r, h) => {
            if (!sheet.styles) sheet.styles = {};
            const key = `${r}_${h}`;
            sheet.styles[key] = { ...(sheet.styles[key] || {}), [styleType]: value };
        };

        if (styleScope === 'cell') {
            applyToCell(focusedCell.r, focusedCell.header);
        } else if (styleScope === 'range' && selection.start && selection.end) {
            const rStart = Math.min(selection.start.r, selection.end.r);
            const rEnd = Math.max(selection.start.r, selection.end.r);
            const cStart = Math.min(selection.start.c, selection.end.c);
            const cEnd = Math.max(selection.start.c, selection.end.c);
            
            for (let r = rStart; r <= rEnd; r++) {
                for (let c = cStart; c <= cEnd; c++) {
                    const h = currentSheet.headers[c];
                    applyToCell(r, h);
                }
            }
        } else if (styleScope === 'row') {
            if (!sheet.rowStyles) sheet.rowStyles = {};
            sheet.rowStyles[focusedCell.r] = { ...(sheet.rowStyles[focusedCell.r] || {}), [styleType]: value };
        } else if (styleScope === 'column') {
            if (!sheet.colStyles) sheet.colStyles = {};
            sheet.colStyles[focusedCell.header] = { ...(sheet.colStyles[focusedCell.header] || {}), [styleType]: value };
        }

        setSelectedWorkbook({ ...updatedWorkbook });
        debouncedSave(updatedWorkbook);
    };

    const debouncedSave = async (workbook) => {
        try {
            await fetch(`${API_BASE_URL}/excel-lists/${workbook.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(workbook)
            });
        } catch (err) {
            console.error('Error saving workbook:', err);
        }
    };

    const handleExportExcel = async () => {
        if (!selectedWorkbook) return;
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sistem';
            workbook.lastModifiedBy = 'Sistem';
            workbook.created = new Date();
            
            const sheetsToExport = selectedWorkbook.isWorkbook && selectedWorkbook.sheets 
                ? selectedWorkbook.sheets 
                : [{ name: selectedWorkbook.listName || 'Sayfa1', headers: selectedWorkbook.headers, data: selectedWorkbook.data, styles: selectedWorkbook.styles || {} }];

            sheetsToExport.forEach(sheetData => {
                const sheet = workbook.addWorksheet(sheetData.name);
                
                if (sheetData.headers && sheetData.headers.length > 0) {
                    sheet.addRow(sheetData.headers);
                    sheet.getRow(1).font = { bold: true };
                }

                sheetData.data.forEach((row, rIdx) => {
                    const rowData = sheetData.headers.map(h => row[h] !== undefined && row[h] !== null ? row[h] : '');
                    sheet.addRow(rowData);
                    
                    sheetData.headers.forEach((h, cIdx) => {
                        const cell = sheet.getCell(rIdx + 2, cIdx + 1);
                        const styleInfo = sheetData.styles?.[`${rIdx}_${h}`] || {};
                        const rowStyleInfo = sheetData.rowStyles?.[rIdx] || {};
                        const colStyleInfo = sheetData.colStyles?.[h] || {};

                        const color = styleInfo.color || rowStyleInfo.color || colStyleInfo.color;
                        const bgColor = styleInfo.bgColor || rowStyleInfo.bgColor || colStyleInfo.bgColor;
                        const bold = styleInfo.bold || rowStyleInfo.bold || colStyleInfo.bold;
                        const italic = styleInfo.italic || rowStyleInfo.italic || colStyleInfo.italic;
                        const underline = styleInfo.underline || rowStyleInfo.underline || colStyleInfo.underline;

                        if (color || bold || italic || underline) {
                            cell.font = {
                                ...(color && color !== 'inherit' && { color: { argb: 'FF' + color.replace('#', '') } }),
                                ...(bold && { bold: true }),
                                ...(italic && { italic: true }),
                                ...(underline && { underline: true })
                            };
                        }

                        if (bgColor && bgColor !== 'transparent') {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FF' + bgColor.replace('#', '') }
                            };
                        }
                    });
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedWorkbook.listName}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Excel dışa aktarma hatası:', err);
            showAlert('Hata', 'Belge dışa aktarılırken bir hata oluştu.');
        }
    };

    // Selection Logic
    const handleMouseDown = (r, c, header) => {
        setFocusedCell({ r, c, header });
        setSelection({ start: { r, c }, end: { r, c }, active: true });
        if (styleScope === 'cell') setStyleScope('range');
    };

    const handleMouseEnterSelection = (r, c) => {
        if (selection.active) {
            setSelection(prev => ({ ...prev, end: { r, c } }));
        }
    };

    const handleMouseUp = () => {
        setSelection(prev => ({ ...prev, active: false }));
    };

    // Context Menu Handlers
    const handleContextMenu = (e, r, c, header) => {
        e.preventDefault();
        setFocusedCell({ r, c, header });
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            r, c, header
        });
    };

    const handleInsertRow = (offset) => {
        const updatedWorkbook = { ...selectedWorkbook };
        const sheet = updatedWorkbook.isWorkbook ? updatedWorkbook.sheets[activeSheetIndex] : updatedWorkbook;
        const newRow = {};
        sheet.headers.forEach(h => newRow[h] = '');
        sheet.data.splice(contextMenu.r + offset, 0, newRow);
        setSelectedWorkbook(updatedWorkbook);
        debouncedSave(updatedWorkbook);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleDeleteRow = () => {
        const updatedWorkbook = { ...selectedWorkbook };
        const sheet = updatedWorkbook.isWorkbook ? updatedWorkbook.sheets[activeSheetIndex] : updatedWorkbook;
        sheet.data.splice(contextMenu.r, 1);
        setSelectedWorkbook(updatedWorkbook);
        debouncedSave(updatedWorkbook);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleInsertColumn = (offset) => {
        const updatedWorkbook = { ...selectedWorkbook };
        const sheet = updatedWorkbook.isWorkbook ? updatedWorkbook.sheets[activeSheetIndex] : updatedWorkbook;
        const newColHeader = `Yeni Sütun ${sheet.headers.length + 1}`;
        sheet.headers.splice(contextMenu.c + offset, 0, newColHeader);
        sheet.data = sheet.data.map(row => ({ ...row, [newColHeader]: '' }));
        setSelectedWorkbook(updatedWorkbook);
        debouncedSave(updatedWorkbook);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleDeleteColumn = () => {
        const updatedWorkbook = { ...selectedWorkbook };
        const sheet = updatedWorkbook.isWorkbook ? updatedWorkbook.sheets[activeSheetIndex] : updatedWorkbook;
        const headerToDelete = contextMenu.header;
        sheet.headers = sheet.headers.filter(h => h !== headerToDelete);
        sheet.data = sheet.data.map(row => {
            const { [headerToDelete]: _, ...rest } = row;
            return rest;
        });
        setSelectedWorkbook(updatedWorkbook);
        debouncedSave(updatedWorkbook);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleClearCellByMenu = () => {
        handleUpdateListValue(contextMenu.r, contextMenu.header, '');
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleCopyCellByMenu = () => {
        const value = currentSheet.data[contextMenu.r][contextMenu.header] || '';
        navigator.clipboard.writeText(value);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleSelectFullRow = (r) => {
        setSelection({ 
            start: { r, c: 0 }, 
            end: { r, c: currentSheet.headers.length - 1 }, 
            active: false 
        });
        setStyleScope('range');
        if (currentSheet.headers.length > 0) {
            setFocusedCell({ r, c: 0, header: currentSheet.headers[0] });
        }
    };

    const handleSelectFullColumn = (c) => {
        setSelection({ 
            start: { r: 0, c }, 
            end: { r: currentSheet.data.length - 1, c }, 
            active: false 
        });
        setStyleScope('range');
        if (currentSheet.data.length > 0) {
            setFocusedCell({ r: 0, c, header: currentSheet.headers[c] });
        }
    };

    const isCellSelected = (r, c) => {
        if (!selection.start || !selection.end) return false;
        const rStart = Math.min(selection.start.r, selection.end.r);
        const rEnd = Math.max(selection.start.r, selection.end.r);
        const cStart = Math.min(selection.start.c, selection.end.c);
        const cEnd = Math.max(selection.start.c, selection.end.c);
        return r >= rStart && r <= rEnd && c >= cStart && c <= cEnd;
    };

    const getCellStyle = (rowIndex, header) => {
        const sheet = selectedWorkbook?.isWorkbook ? selectedWorkbook.sheets[activeSheetIndex] : selectedWorkbook;
        const cellStyle = sheet?.styles?.[`${rowIndex}_${header}`] || {};
        const rowStyle = sheet?.rowStyles?.[rowIndex] || {};
        const colStyle = sheet?.colStyles?.[header] || {};

        return {
            color: cellStyle.color || rowStyle.color || colStyle.color || 'inherit',
            backgroundColor: cellStyle.bgColor || rowStyle.bgColor || colStyle.bgColor || 'transparent',
            fontWeight: (cellStyle.bold || rowStyle.bold || colStyle.bold) ? '900' : '600',
            fontStyle: (cellStyle.italic || rowStyle.italic || colStyle.italic) ? 'italic' : 'normal',
            textDecoration: (cellStyle.underline || rowStyle.underline || colStyle.underline) ? 'underline' : 'none',
            fontSize: cellStyle.fontSize || rowStyle.fontSize || colStyle.fontSize || '11px'
        };
    };

    const getColName = (n) => {
        let ordA = 'A'.charCodeAt(0);
        let ordZ = 'Z'.charCodeAt(0);
        let len = ordZ - ordA + 1;
        let s = "";
        while(n >= 0) {
            s = String.fromCharCode(n % len + ordA) + s;
            n = Math.floor(n / len) - 1;
        }
        return s;
    };

    const currentSheet = selectedWorkbook?.isWorkbook 
        ? selectedWorkbook.sheets[activeSheetIndex] 
        : { name: selectedWorkbook?.listName, headers: selectedWorkbook?.headers, data: selectedWorkbook?.data };

    const getFocusedCellStyle = () => {
        if (!focusedCell) return {};
        const sheet = selectedWorkbook?.isWorkbook ? selectedWorkbook.sheets[activeSheetIndex] : selectedWorkbook;
        if (styleScope === 'cell' || styleScope === 'range') return sheet?.styles?.[`${focusedCell.r}_${focusedCell.header}`] || {};
        if (styleScope === 'row') return sheet?.rowStyles?.[focusedCell.r] || {};
        if (styleScope === 'column') return sheet?.colStyles?.[focusedCell.header] || {};
        return {};
    };

    const getDocumentBgColors = () => {
        const sheet = selectedWorkbook?.isWorkbook ? selectedWorkbook.sheets[activeSheetIndex] : selectedWorkbook;
        if (!sheet || !sheet.styles) return [];
        const colors = new Set();
        Object.values(sheet.styles).forEach(s => {
            if (s.bgColor && s.bgColor !== 'transparent') colors.add(s.bgColor);
        });
        return Array.from(colors).slice(0, 6); // Max 6 colors
    };

    const WorkbookIcon = () => (
        <div className="w-16 h-20 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden group-hover:shadow-2xl group-hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 right-0 w-8 h-8 bg-green-500 rounded-bl-3xl"></div>
            <svg className="w-8 h-8 text-green-600 mb-1" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
            <div className="w-8 h-0.5 bg-gray-100 rounded-full"></div>
            <div className="w-6 h-0.5 bg-gray-50 rounded-full mt-1"></div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col animate-in fade-in duration-700 select-none overflow-hidden bg-gray-50" onMouseUp={handleMouseUp}>
            {/* FINDER STYLE DASHBOARD */}
            {!isFullView && (
                <div className="flex-1 flex overflow-hidden bg-white">
                    {/* Finder Sidebar */}
                    <div className="w-[260px] bg-gray-50/50 backdrop-blur-xl border-r border-gray-200/60 flex flex-col shrink-0 select-none">
                        <div className="px-6 py-8">
                            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                                E. Merkezi
                            </h1>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 ml-8">Dosya Yöneticisi</p>
                        </div>
                        
                        <div className="flex-1 px-4 flex flex-col gap-1">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 mb-2 mt-4">Konumlar</div>
                            
                            <button onClick={() => setActiveTab('all')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTab === 'all' ? 'bg-blue-50/80 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                Tüm Belgeler
                            </button>
                            <button onClick={() => setActiveTab('recent')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTab === 'recent' ? 'bg-blue-50/80 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Son Kullanılanlar
                            </button>
                            <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTab === 'favorites' ? 'bg-blue-50/80 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                                Favoriler
                            </button>
                            
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 mb-2 mt-6">Sistem</div>
                            <button onClick={() => setActiveTab('trash')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTab === 'trash' ? 'bg-blue-50/80 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Çöp Kutusu
                            </button>
                        </div>
                    </div>

                    {/* Finder Main Space */}
                    <div className="flex-1 flex flex-col bg-white min-w-0" onClick={() => setSelectedWorkbook(null)}>
                        {/* Finder Toolbar */}
                        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 text-gray-400">
                                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                    </button>
                                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors opacity-50 cursor-not-allowed">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                    </button>
                                </div>
                                <h2 className="text-sm font-bold text-gray-800 ml-2">
                                    {activeTab === 'all' && 'Tüm Belgeler'}
                                    {activeTab === 'recent' && 'Son Kullanılanlar'}
                                    {activeTab === 'favorites' && 'Favoriler'}
                                    {activeTab === 'trash' && 'Çöp Kutusu'}
                                </h2>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Ara..." className="w-56 h-8 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
                                </div>
                                {selectedWorkbook && (
                                    <button onClick={(e) => { e.stopPropagation(); handleExportExcel(); }} className="bg-white border border-gray-200 text-gray-700 px-4 py-1.5 flex items-center gap-2 rounded-lg font-bold text-xs hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                        İndir
                                    </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setShowImportModal(true); }} className="bg-blue-600 text-white px-4 py-1.5 flex items-center gap-2 rounded-lg font-bold text-xs hover:bg-blue-700 transition-all shadow-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                    Yeni Ekle
                                </button>
                            </div>
                        </div>

                        {/* File Grid */}
                        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                            {loading ? (
                                <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-6">
                                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-[4/5] bg-gray-50 rounded-xl animate-pulse"></div>)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-x-4 gap-y-8">
                                    {displayLists.map(list => {
                                        const isSelected = selectedWorkbook?.id === list.id;
                                        return (
                                            <div 
                                                key={list.id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedWorkbook(list); setContextMenu(prev => ({...prev, visible: false})); }}
                                                onDoubleClick={() => { setSelectedWorkbook(list); setIsFullView(true); }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setSelectedWorkbook(list);
                                                    setContextMenu({
                                                        visible: true,
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        isFinderMenu: true,
                                                        listId: list.id
                                                    });
                                                }}
                                                className="group flex flex-col items-center cursor-pointer relative"
                                            >
                                                <div className={`p-4 rounded-xl transition-all ${isSelected ? 'bg-blue-50/60 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}>
                                                    <div className={`w-14 h-16 bg-white shadow-sm border ${isSelected ? 'border-blue-400' : 'border-gray-200'} rounded-lg flex flex-col items-center relative overflow-hidden transition-all group-hover:drop-shadow-md`}>
                                                        <div className="absolute top-0 right-0 w-5 h-5 bg-gradient-to-bl from-gray-100 to-white border-b border-l border-gray-100 rounded-bl-lg"></div>
                                                        <div className="flex-1 flex items-center justify-center pt-2">
                                                            <svg className={`w-7 h-7 ${isSelected ? 'text-blue-500' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`mt-1.5 px-2 py-0.5 rounded text-center w-full ${isSelected ? 'bg-blue-500 text-white shadow-sm' : ''}`}>
                                                    <p className={`text-[11px] leading-snug break-words ${isSelected ? 'font-bold' : 'text-gray-800 font-medium line-clamp-2'}`}>
                                                        {list.listName}
                                                    </p>
                                                    <p className={`text-[9px] font-medium mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                                                        Excel
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN EXCEL POWER STATION */}
            {isFullView && selectedWorkbook && currentSheet && (
                <div className="fixed inset-0 z-[100] bg-gray-950/20 backdrop-blur-md flex items-center justify-center p-2 animate-in fade-in duration-300">
                    <div className="bg-white w-full h-full rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-gray-200 border-white/40">
                        {/* 1. SLIM HEADER & EXCEL TOOLBAR */}
                        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsFullView(false)} className="text-gray-400 hover:text-gray-900 transition-all">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                                </button>
                                <div className="h-6 w-px bg-gray-100"></div>
                                <h3 className="text-sm font-black text-gray-900">{selectedWorkbook.listName}</h3>
                            </div>
                            
                            {/* ADVANCED TOOLBAR */}
                            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                                <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 mr-2 shadow-sm">
                                    {[
                                        { id: 'cell', label: 'H' },
                                        { id: 'range', label: 'A' },
                                        { id: 'row', label: 'S' },
                                        { id: 'column', label: 'ST' }
                                    ].map(s => (
                                        <button key={s.id} onClick={() => setStyleScope(s.id)} className={`px-2.5 py-0.5 rounded-md text-[9px] font-black transition-all ${styleScope === s.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => handleApplyStyle('bold', !getFocusedCellStyle().bold)} className={`p-1.5 rounded-lg transition-all ${getFocusedCellStyle().bold ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-900'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 12h8a4 4 0 000-8H6v8zm0 0h10a4 4 0 010 8H6v-8z"></path></svg>
                                </button>
                                <button onClick={() => handleApplyStyle('italic', !getFocusedCellStyle().italic)} className={`p-1.5 rounded-lg transition-all ${getFocusedCellStyle().italic ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-900'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 20l4-16m4 0h-4m-4 16h4"></path></svg>
                                </button>
                                <button onClick={() => handleApplyStyle('underline', !getFocusedCellStyle().underline)} className={`p-1.5 rounded-lg transition-all ${getFocusedCellStyle().underline ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-900'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M16 4v7a4 4 0 01-8 0V4M8 20h8"></path></svg>
                                </button>

                                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                
                                <select 
                                    className="bg-white border border-gray-200 rounded-lg text-[10px] font-black px-1 py-0.5 outline-none"
                                    value={getFocusedCellStyle().fontSize || '11px'}
                                    onChange={(e) => handleApplyStyle('fontSize', e.target.value)}
                                >
                                    {['9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px'].map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>

                                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                <div className="grid grid-cols-5 gap-0.5">
                                    {['#000000', '#374151', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6'].map(c => (
                                        <button key={c} onClick={() => handleApplyStyle('color', c)} className={`w-3.5 h-3.5 rounded-sm border border-white hover:scale-110 transition-transform ${getFocusedCellStyle().color === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                <div className="relative flex items-center gap-1">
                                    <div className="grid grid-cols-6 gap-0.5 pl-1">
                                        {['transparent', '#F3F4F6', '#FEE2E2', '#FFEDD5', '#FEF3C7', '#ECFDF5', '#E0F2FE', '#E0E7FF', '#EDE9FE', '#FAE8FF', '#FDF2F8', '#FFF7ED'].map(c => (
                                            <button title={c === 'transparent' ? 'Renksiz' : 'Sistem Rengi'} key={c} onClick={() => handleApplyStyle('bgColor', c)} className={`w-3.5 h-3.5 rounded-sm border border-gray-200 hover:scale-110 transition-transform flex items-center justify-center ${getFocusedCellStyle().bgColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`} style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}>
                                                {c === 'transparent' && <div className="w-full h-px bg-red-400/50 -rotate-45"></div>}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {getDocumentBgColors().length > 0 && (
                                        <>
                                            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
                                            <div className="flex flex-wrap gap-0.5 max-w-[34px] justify-start">
                                                {getDocumentBgColors().map(c => (
                                                    <button title="Belgedeki Orijinal Renk" key={'doc_'+c} onClick={() => handleApplyStyle('bgColor', c)} className={`w-3.5 h-3.5 rounded-sm border-gray-400 shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] hover:scale-110 transition-transform flex items-center justify-center ${getFocusedCellStyle().bgColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`} style={{ backgroundColor: c }}>
                                                        <div className="w-1 h-1 rounded-full bg-white/60 mix-blend-difference pointer-events-none"></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
                                    <label title="İstediğin Rengi Seç" className="w-4 h-4 rounded-md shadow-sm border border-gray-200 hover:scale-110 transition-all flex items-center justify-center cursor-pointer relative overflow-hidden group ml-1">
                                        <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                                        <input type="color" className="absolute opacity-0 w-full h-full cursor-pointer" onChange={(e) => handleApplyStyle('bgColor', e.target.value)} />
                                        <div className="w-1.5 h-1.5 bg-white rounded-full z-10 shadow-sm pointer-events-none"></div>
                                    </label>
                                </div>
                            </div>

                            <button onClick={() => setIsFullView(false)} className="px-8 py-2.5 bg-gray-950 text-white rounded-xl text-[10px] font-black hover:bg-black transition-all shadow-xl shadow-gray-200 uppercase tracking-widest">Tamamla</button>
                        </div>

                        {/* 2. FORMULA BAR (ABOVE TABS) */}
                        <div className="h-10 border-b border-gray-100 flex items-center bg-gray-50/50 px-4 shrink-0">
                            <div className="w-16 text-[10px] font-black text-gray-400 border-r border-gray-200 text-center uppercase tracking-widest">
                                {focusedCell ? `${getColName(focusedCell.c)}${focusedCell.r + 1}` : '-'}
                            </div>
                            <div className="flex-1 px-4 flex items-center gap-3">
                                <span className="text-gray-300 font-black italic select-none">fx</span>
                                <input 
                                    type="text" 
                                    value={focusedCell ? (currentSheet.data[focusedCell.r]?.[focusedCell.header] || '') : ''} 
                                    onChange={(e) => handleUpdateListValue(focusedCell.r, focusedCell.header, e.target.value)}
                                    placeholder="Değer girin..."
                                    className="flex-1 bg-transparent border-none text-xs font-bold text-gray-700 outline-none"
                                />
                            </div>
                        </div>

                        {/* 3. SHEETS TABS */}
                        {selectedWorkbook.isWorkbook && selectedWorkbook.sheets && selectedWorkbook.sheets.length > 1 && (
                            <div className="flex bg-white border-b border-gray-100 flex-none overflow-x-auto no-scrollbar">
                                {selectedWorkbook.sheets.map((sheet, index) => (
                                    <button
                                        key={index}
                                        onClick={() => { setActiveSheetIndex(index); setSelection({ start: null, end: null, active: false }); }}
                                        className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeSheetIndex === index ? 'text-blue-600 bg-blue-50/10' : 'text-gray-400 hover:text-gray-700'}`}
                                    >
                                        {sheet.name}
                                        {activeSheetIndex === index && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 4. MAIN EXCEL TABLE (POWERFUL) */}
                        <div className="flex-1 overflow-auto custom-scrollbar bg-white" ref={tableRef}>
                            <table className="w-full text-left border-collapse table-fixed min-w-max">
                                <thead className="sticky top-0 z-30">
                                    <tr className="bg-gray-100/90 backdrop-blur-md border-b border-gray-200">
                                        <th className="w-12 bg-gray-200/50 border-r border-gray-200"></th>
                                        {currentSheet.headers.map((h, i) => (
                                            <th 
                                                key={i} 
                                                onDoubleClick={() => handleSelectFullColumn(i)}
                                                className={`px-2 py-2 text-[10px] font-black text-gray-400 text-center border-r border-gray-200 w-[180px] transition-colors cursor-pointer hover:bg-blue-50 ${focusedCell?.c === i ? 'bg-blue-600 text-white' : ''}`}
                                            >
                                                {getColName(i)}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="bg-gray-50/80 backdrop-blur-md border-b border-gray-200">
                                        <th className="w-12"></th>
                                        {currentSheet.headers.map((h, i) => (
                                            <th key={i} className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-200 bg-gray-50/30">
                                                {h || '-'}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentSheet.data.map((row, rIdx) => (
                                        <tr key={rIdx} className="group">
                                            <td 
                                                onDoubleClick={() => handleSelectFullRow(rIdx)}
                                                className={`w-12 text-center text-[10px] font-black border-r border-gray-200 sticky left-0 z-20 transition-colors cursor-pointer hover:bg-blue-50 ${focusedCell?.r === rIdx ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-300'}`}
                                            >
                                                {rIdx + 1}
                                            </td>
                                            {currentSheet.headers.map((header, cIdx) => {
                                                const style = getCellStyle(rIdx, header);
                                                const selected = isCellSelected(rIdx, cIdx);
                                                const focused = focusedCell?.r === rIdx && focusedCell?.c === cIdx;
                                                return (
                                                    <td 
                                                        key={cIdx} 
                                                        className={`px-1 py-0.5 border-r border-gray-100 transition-all align-top relative ${selected ? 'bg-blue-50/80 shadow-inner' : ''}`}
                                                        style={{ backgroundColor: style.backgroundColor }}
                                                        onMouseDown={() => handleMouseDown(rIdx, cIdx, header)}
                                                        onMouseEnter={() => handleMouseEnterSelection(rIdx, cIdx)}
                                                        onContextMenu={(e) => handleContextMenu(e, rIdx, cIdx, header)}
                                                    >
                                                        <textarea 
                                                            rows="1"
                                                            value={row[header] || ''} 
                                                            onChange={(e) => handleUpdateListValue(rIdx, header, e.target.value)}
                                                            className={`w-full bg-transparent border-none py-1 px-1.5 outline-none resize-none overflow-hidden whitespace-pre-wrap break-words min-h-[24px] ${focused ? 'ring-[1.5px] ring-blue-500 ring-inset rounded-lg z-10' : ''}`}
                                                            style={{ 
                                                                color: style.color, 
                                                                fontWeight: style.fontWeight,
                                                                fontStyle: style.fontStyle,
                                                                textDecoration: style.textDecoration,
                                                                fontSize: style.fontSize,
                                                                lineHeight: '1.2'
                                                            }}
                                                            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                            spellCheck="false"
                                                        />
                                                        {selected && !focused && <div className="absolute inset-0 bg-blue-400/10 pointer-events-none"></div>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 5. SLIM FOOTER */}
                        <div className="h-8 bg-gray-50 border-t border-gray-100 flex items-center justify-between px-6 shrink-0 shadow-inner">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                SEÇİM: {selection.start ? `${getColName(selection.start.c)}${selection.start.r+1}:${getColName(selection.end.c)}${selection.end.r+1}` : '-'}
                            </span>
                            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                <span>TOPLAM: {currentSheet.data.length}</span>
                                <div className="h-3 w-px bg-gray-300"></div>
                                <div className="flex items-center gap-1.5 text-blue-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                    CLOUD SYNC AKTİF
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM CONTEXT MENU */}
            {contextMenu.visible && (
                <div 
                    className="context-menu fixed z-[200] bg-white/95 backdrop-blur-md border border-gray-200 shadow-2xl rounded-2xl py-2 min-w-[200px] animate-in zoom-in-95 duration-200 overflow-hidden"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {contextMenu.isFinderMenu ? (() => {
                        const list = lists.find(l => l.id === contextMenu.listId);
                        if (!list) return null;
                        
                        return (
                            <>
                                <div className="px-4 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1">
                                    Belge İşlemleri
                                </div>
                                {!list.isTrashed && (
                                    <>
                                        <button onClick={() => { setIsFullView(true); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                            Aç ve Düzenle
                                        </button>
                                        <button onClick={() => toggleFavorite(list.id)} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors">
                                            <svg className={`w-4 h-4 ${list.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                                            {list.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                                        </button>
                                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                                        <button onClick={() => moveToTrash(list.id)} className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-3 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            Çöpe Taşı
                                        </button>
                                    </>
                                )}
                                {list.isTrashed && (
                                    <>
                                        <button onClick={() => restoreFromTrash(list.id)} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-green-600 hover:text-white flex items-center gap-3 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                            Geri Yükle
                                        </button>
                                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                                        <button onClick={() => handleDelete(list.id)} className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-3 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            Kalıcı Olarak Sil
                                        </button>
                                    </>
                                )}
                            </>
                        );
                    })() : (
                        <>
                            <div className="px-4 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1">
                                Hücre: {getColName(contextMenu.c)}{contextMenu.r + 1}
                            </div>
                            
                            {/* HÜCRE İŞLEMLERİ */}
                            <button onClick={handleCopyCellByMenu} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                                Metni Kopyala
                            </button>
                            <button onClick={handleClearCellByMenu} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-red-600 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                İçeriği Temizle
                            </button>

                            <div className="h-px bg-gray-100 my-1 mx-2"></div>

                            {/* SATIR İŞLEMLERİ */}
                            <button onClick={() => handleInsertRow(0)} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-500 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7M3 15l2-2 2 2"></path></svg>
                                Üste Satır Ekle
                            </button>
                            <button onClick={() => handleInsertRow(1)} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-500 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7-6h7M3 9l2 2 2-2"></path></svg>
                                Alta Satır Ekle
                            </button>
                            <button onClick={handleDeleteRow} className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Satırı Sil
                            </button>

                            <div className="h-px bg-gray-100 my-1 mx-2"></div>

                            {/* SÜTUN İŞLEMLERİ */}
                            <button onClick={() => handleInsertColumn(0)} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-400 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7M3 15l2-2 2 2"></path></svg>
                                Sola Sütun Ekle
                            </button>
                            <button onClick={() => handleInsertColumn(1)} className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-400 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7-6h7M3 9l2 2 2-2"></path></svg>
                                Sağa Sütun Ekle
                            </button>
                            <button onClick={handleDeleteColumn} className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-3 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Sütunu Sil
                            </button>
                        </>
                    )}
                </div>
            )}

            {showImportModal && <ExcelImportModal onClose={() => setShowImportModal(false)} onImport={handleImport} token={token} />}
        </div>
    );
};

export default ExcelLists;
