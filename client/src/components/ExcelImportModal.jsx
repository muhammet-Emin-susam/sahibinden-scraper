import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

const ExcelImportModal = ({ onClose, onImport, token }) => {
    const [file, setFile] = useState(null);
    const [sheetsData, setSheetsData] = useState({}); // { 'Sheet1': { headers: [], rows: [] } }
    const [activeSheet, setActiveSheet] = useState(null);
    const [listName, setListName] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
                setFile(selectedFile);
                setListName(selectedFile.name.split('.')[0]);
                parseExcel(selectedFile);
            } else {
                setError('Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)');
            }
        }
    };

    const parseExcel = (file) => {
        setIsParsing(true);
        setError('');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const allSheets = {};
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length > 0) {
                        const headers = jsonData[0].map(h => h ? h.toString() : '');
                        const rows = jsonData.slice(1).map(row => {
                            const obj = {};
                            headers.forEach((header, index) => {
                                if (header) {
                                    obj[header] = row[index] !== undefined ? row[index] : '';
                                }
                            });
                            return obj;
                        });
                        allSheets[sheetName] = { headers, rows };
                    }
                });

                if (Object.keys(allSheets).length === 0) {
                    setError('Excel dosyası boş veya okunaklı veri içermiyor.');
                    setIsParsing(false);
                    return;
                }

                setSheetsData(allSheets);
                setActiveSheet(workbook.SheetNames[0]);
                setIsParsing(false);
            } catch (err) {
                console.error('Excel parsing error:', err);
                setError('Excel dosyası okunurken bir hata oluştu.');
                setIsParsing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSave = () => {
        if (!listName.trim()) {
            setError('Lütfen bir liste adı girin.');
            return;
        }
        
        const workbookData = {
            fileName: listName.trim(),
            sheets: Object.entries(sheetsData).map(([name, data]) => ({
                name,
                headers: data.headers,
                data: data.rows
            }))
        };

        onImport(workbookData);
    };

    const handleCellChange = (rowIndex, header, value) => {
        const updatedSheets = { ...sheetsData };
        updatedSheets[activeSheet].rows[rowIndex][header] = value;
        setSheetsData(updatedSheets);
    };

    const currentData = activeSheet ? sheetsData[activeSheet] : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zM15.08 11L13 13.08 10.92 11 10 11.92 12.08 14 10 16.08 10.92 17 13 14.92 15.08 17 16 16.08 13.92 14 16 11.92 15.08 11z"/></svg>
                            </div>
                            Excel Veri Aktarımı
                        </h3>
                        <p className="text-sm text-gray-500 font-medium mt-1">Seka desteği ile tüm sayfalarınızı yönetin ve kaydedin.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {!activeSheet ? (
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            className="border-2 border-dashed border-gray-200 rounded-[24px] p-20 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group bg-gray-50/30"
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
                            <div className="w-24 h-24 bg-blue-100 rounded-[24px] flex items-center justify-center text-blue-600 mx-auto mb-8 group-hover:scale-110 transition-all shadow-lg shadow-blue-50 relative overflow-hidden">
                                <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <h4 className="text-2xl font-black text-gray-900 mb-2">Excel Dosyasını Seçin</h4>
                            <p className="text-gray-500 font-medium max-w-sm mx-auto leading-relaxed">Sürükleyip bırakın veya tıklayın. Çok sekmeli dosyalar otomatik olarak ayrıştırılır.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">LİSTE ANA BAŞLIĞI</label>
                                    <input 
                                        type="text" 
                                        value={listName} 
                                        onChange={(e) => setListName(e.target.value)} 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                        placeholder="Dosya için genel bir isim girin..."
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => { setSheetsData({}); setActiveSheet(null); setFile(null); }}
                                        className="px-6 py-4 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        Dosyayı Temizle
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-100 rounded-[28px] overflow-hidden shadow-xl shadow-gray-100 flex flex-col min-h-[400px]">
                                {/* Sheet Selector (Tabs) */}
                                {Object.keys(sheetsData).length > 1 && (
                                    <div className="flex bg-gray-50 border-b border-gray-100 px-4 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth">
                                        {Object.keys(sheetsData).map(name => (
                                            <button
                                                key={name}
                                                onClick={() => setActiveSheet(name)}
                                                className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative border-r border-gray-100 last:border-0 ${activeSheet === name ? 'text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
                                            >
                                                {name}
                                                {activeSheet === name && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex-1 overflow-x-auto max-h-[450px] custom-scrollbar">
                                    {currentData && (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-gray-50/80 backdrop-blur-md border-b border-gray-100">
                                                    {currentData.headers.map((header, i) => (
                                                        <th key={i} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">{header || `Kolon ${i+1}`}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {currentData.rows.map((row, rowIndex) => (
                                                    <tr key={rowIndex} className="hover:bg-blue-50/30 transition-colors">
                                                        {currentData.headers.map((header, colIndex) => (
                                                            <td key={colIndex} className="px-6 py-3">
                                                                <input 
                                                                    type="text" 
                                                                    value={row[header] || ''} 
                                                                    onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                                                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-200 rounded-lg text-xs text-gray-700 font-bold py-1.5 px-2 transition-all outline-none"
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                Toplam: {currentData?.rows.length || 0} Satır Veri İşlendi
                                {Object.keys(sheetsData).length > 1 && ` • ${Object.keys(sheetsData).length} Sekme Mevcut`}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-8 p-5 bg-red-50 text-red-600 rounded-[20px] text-sm font-black flex items-center gap-4 animate-shake border border-red-100">
                            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-xs text-gray-400 font-bold max-w-sm text-center md:text-left">
                        Kaydet dediğinizde tüm sekmeler ayrı isimlerde kalıcı listeler olarak kaydedilecektir.
                    </p>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button onClick={onClose} className="flex-1 md:flex-none px-10 py-4 text-sm font-black text-gray-500 hover:bg-white hover:shadow-lg rounded-[20px] transition-all border border-transparent hover:border-gray-200">
                            İptal
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={!activeSheet || isParsing}
                            className="flex-1 md:flex-none px-12 py-4 bg-blue-600 text-white rounded-[20px] text-sm font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                            {Object.keys(sheetsData).length > 1 ? `${Object.keys(sheetsData).length} Sekmeyi Kaydet` : 'Listeyi Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExcelImportModal;
