import { useState, useRef } from 'react';
import ExcelJS from 'exceljs';

const ExcelImportModal = ({ onClose, onImport, token }) => {
    const [file, setFile] = useState(null);
    const [sheetsData, setSheetsData] = useState({}); // { 'Sheet1': { headers: [], rows: [], styles: {} } }
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

    const parseExcel = async (file) => {
        setIsParsing(true);
        setError('');
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            
            const allSheets = {};
            
            workbook.eachSheet((worksheet, sheetId) => {
                const sheetName = worksheet.name;
                if (worksheet.rowCount === 0) return;

                let headers = [];
                const headerRow = worksheet.getRow(1);
                const colCount = worksheet.columnCount;
                
                for (let c = 1; c <= colCount; c++) {
                    const cell = headerRow.getCell(c);
                    let val = cell.value;
                    if (val && typeof val === 'object' && val.richText) {
                        val = val.richText.map(rt => rt.text).join('');
                    } else if (val && typeof val === 'object' && val.result !== undefined) {
                        val = val.result;
                    }
                    headers.push(val ? val.toString() : `Kolon ${c}`);
                }

                const rows = [];
                const styles = {}; // store styles here

                for (let r = 2; r <= worksheet.rowCount; r++) {
                    const rowObj = {};
                    const dataRow = worksheet.getRow(r);
                    if (!dataRow.hasValues) continue;
                    
                    const dataRowIndex = rows.length;

                    for (let c = 1; c <= colCount; c++) {
                        const header = headers[c - 1];
                        if (!header) continue;
                        
                        const cell = dataRow.getCell(c);
                        let val = cell.value;
                        
                        // handle formula objects and rich text
                        if (val && typeof val === 'object') {
                            if (val.richText) {
                                val = val.richText.map(rt => rt.text).join('');
                            } else if (val.result !== undefined) {
                                val = val.result;
                            } else if (val.text) {
                                val = val.text;
                            } else if (val.hyperlink) {
                                val = val.hyperlink;
                            } else {
                                val = JSON.stringify(val); // fallback
                            }
                        }
                        
                        rowObj[header] = val !== null && val !== undefined ? val : '';
                        
                        // Extract styling!
                        const style = {};
                        if (cell.font) {
                            if (cell.font.color && cell.font.color.argb) {
                                style.color = `#${cell.font.color.argb.substring(2)}`;
                            }
                            if (cell.font.bold) style.bold = true;
                            if (cell.font.italic) style.italic = true;
                            if (cell.font.underline) style.underline = true;
                        }
                        if (cell.fill) {
                            // If pattern fill is solid, it uses fgColor
                            if (cell.fill.type === 'pattern' && cell.fill.pattern === 'solid') {
                                if (cell.fill.fgColor && cell.fill.fgColor.argb) {
                                    style.bgColor = `#${cell.fill.fgColor.argb.substring(2)}`;
                                }
                            } else {
                                // Fallback
                                if (cell.fill.bgColor && cell.fill.bgColor.argb) {
                                     style.bgColor = `#${cell.fill.bgColor.argb.substring(2)}`;
                                } else if (cell.fill.fgColor && cell.fill.fgColor.argb) {
                                     style.bgColor = `#${cell.fill.fgColor.argb.substring(2)}`;
                                }
                            }
                        }

                        if (Object.keys(style).length > 0) {
                            styles[`${dataRowIndex}_${header}`] = style;
                        }
                    }
                    rows.push(rowObj);
                }

                if (rows.length > 0) {
                    allSheets[sheetName] = { headers, rows, styles };
                }
            });

            if (Object.keys(allSheets).length === 0) {
                setError('Excel dosyası boş veya okunaklı veri içermiyor.');
                setIsParsing(false);
                return;
            }

            setSheetsData(allSheets);
            setActiveSheet(Object.keys(allSheets)[0]);
            setIsParsing(false);
        } catch (err) {
            console.error('Excel parsing error:', err);
            setError('Excel dosyası okunurken bir hata oluştu veya format desteklenmiyor.');
            setIsParsing(false);
        }
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
                data: data.rows,
                styles: data.styles || {}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="bg-white/95 backdrop-blur-xl rounded-[24px] shadow-[0_15px_60px_-15px_rgba(0,0,0,0.2)] w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-500">
                {/* Header */}
                <div className="px-8 py-5 flex items-center justify-between border-b border-gray-100/80 bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-green-100">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zM15.08 11L13 13.08 10.92 11 10 11.92 12.08 14 10 16.08 10.92 17 13 14.92 15.08 17 16 16.08 13.92 14 16 11.92 15.08 11z"/></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 tracking-tight">Excel Veri Aktarımı</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Akıllı Dosya Yönetimi</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
                    {!activeSheet ? (
                        <div className="p-8 h-full flex flex-col items-center justify-center min-h-[400px]">
                            <div 
                                onClick={() => fileInputRef.current.click()}
                                className="group w-full max-w-xl"
                            >
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
                                
                                <div className="relative bg-white border-2 border-dashed border-gray-200 rounded-[24px] p-16 text-center hover:border-blue-500/50 hover:bg-blue-50/30 transition-all cursor-pointer overflow-hidden shadow-sm">
                                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-all duration-300">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    </div>
                                    <h4 className="text-2xl font-bold text-gray-900 mb-3">Excel Dosyası Seçin</h4>
                                    <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto leading-relaxed">
                                        MacOS Finder dokusuyla dosyalarınızı sürükleyin veya <span className="text-blue-600 underline">tıklayarak seçin</span>.
                                    </p>
                                    
                                    {isParsing && (
                                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-in fade-in">
                                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Analiz Ediliyor...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 space-y-8 animate-in fade-in duration-500">
                            {/* Control Bar */}
                            <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex-1 w-full">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-3 mb-2 block">LİSTE ANA BAŞLIĞI</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={listName} 
                                            onChange={(e) => setListName(e.target.value)} 
                                            className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-all outline-none"
                                            placeholder="Dosya ismi..."
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <div className="w-px h-4 bg-gray-200"></div>
                                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setSheetsData({}); setActiveSheet(null); setFile(null); }}
                                    className="h-11 px-5 text-[11px] font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 shrink-0"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Dosyayı Değiştir
                                </button>
                            </div>

                            {/* Preview Section */}
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                                {Object.keys(sheetsData).length > 1 && (
                                    <div className="flex bg-gray-50/30 border-b border-gray-100 px-4 overflow-x-auto no-scrollbar">
                                        {Object.keys(sheetsData).map(name => (
                                            <button
                                                key={name}
                                                onClick={() => setActiveSheet(name)}
                                                className={`px-6 py-4 text-[10px] font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${activeSheet === name ? 'text-blue-600 bg-white border-x border-gray-100 first:border-l-0' : 'text-gray-400 hover:text-gray-700'}`}
                                            >
                                                {name}
                                                {activeSheet === name && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex-1 overflow-auto max-h-[350px] custom-scrollbar">
                                    {currentData && (
                                        <table className="w-full text-left border-collapse min-w-full">
                                            <thead className="sticky top-0 z-20">
                                                <tr className="bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
                                                    <th className="w-10 border-r border-gray-200"></th>
                                                    {currentData.headers.map((header, i) => (
                                                        <th key={i} className="px-5 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest border-r border-gray-100 last:border-0">{header || '-'}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {currentData.rows.map((row, rowIndex) => (
                                                    <tr key={rowIndex} className="group hover:bg-blue-50/20">
                                                        <td className="w-10 text-center text-[9px] font-bold text-gray-300 bg-gray-50/10 border-r border-gray-100">{rowIndex + 1}</td>
                                                        {currentData.headers.map((header, colIndex) => {
                                                            const style = currentData.styles?.[`${rowIndex}_${header}`] || {};
                                                            return (
                                                                <td key={colIndex} className="px-2 py-1 border-r border-gray-50 last:border-0" style={{ backgroundColor: style.bgColor }}>
                                                                    <input 
                                                                        type="text" 
                                                                        value={row[header] || ''} 
                                                                        onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-100 rounded-lg text-[11px] font-semibold py-1 px-2 transition-all outline-none"
                                                                        style={{
                                                                            color: style.color || '#374151',
                                                                            fontWeight: style.bold ? '700' : '500',
                                                                            fontStyle: style.italic ? 'italic' : 'normal',
                                                                            textDecoration: style.underline ? 'underline' : 'none'
                                                                        }}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                            
                            {/* Summary Footer */}
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    Analiz: <span className="text-gray-900">{currentData?.rows.length || 0} Satır Pozitif</span>
                                    {Object.keys(sheetsData).length > 1 && ` • ${Object.keys(sheetsData).length} Sekme`}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mx-8 my-6 p-4 bg-red-50 text-red-600 rounded-xl text-[11px] font-bold flex items-center gap-4 border border-red-100 animate-shake">
                            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <p className="flex-1">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-5 border-t border-gray-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-[11px] font-medium text-gray-400 max-w-sm text-center md:text-left leading-relaxed">
                        Veriler Seka veritabanına kalıcı olarak işlenecektir.
                    </p>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={onClose} 
                            className="flex-1 md:flex-none px-8 py-2.5 text-[12px] font-bold text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-200 active:scale-95 shadow-sm"
                        >
                            İptal
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={!activeSheet || isParsing}
                            className="flex-1 md:flex-none px-10 py-2.5 bg-blue-600 text-white rounded-xl text-[12px] font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                            {Object.keys(sheetsData).length > 1 ? `${Object.keys(sheetsData).length} Sekmeyi Sisteme İşle` : 'LİSTEYİ TAMAMLA'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExcelImportModal;
