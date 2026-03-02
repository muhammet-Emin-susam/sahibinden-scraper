import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function ActivityFeed() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token, user } = useContext(AuthContext);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!token) return;
            try {
                const response = await fetch('/api/activity', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
                if (result.success) {
                    setLogs(result.data);
                }
            } catch (err) {
                console.error("Failed to fetch activity:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchActivity();
        const interval = setInterval(fetchActivity, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, [token]);

    const actionLabel = (a) => ({
        listing_added: { icon: '➕', text: 'İlan eklendi', color: 'text-green-600 bg-green-50 border-green-200' },
        listing_deleted: { icon: '🗑️', text: 'İlan silindi', color: 'text-red-600 bg-red-50 border-red-200' },
        soft_deleted: { icon: '🗑️', text: 'Çöpe taşındı', color: 'text-orange-600 bg-orange-50 border-orange-200' },
        hard_deleted: { icon: '💥', text: 'Kalıcı silindi', color: 'text-red-700 bg-red-100 border-red-300' },
        restored: { icon: '♻️', text: 'Geri alındı', color: 'text-teal-600 bg-teal-50 border-teal-200' },
        status_changed: { icon: '🔄', text: 'Durum değişti', color: 'text-blue-600 bg-blue-50 border-blue-200' },
        status_tag_changed: { icon: '🏷️', text: 'Etiket değişti', color: 'text-purple-600 bg-purple-50 border-purple-200' },
        note_changed: { icon: '📝', text: 'Not güncellendi', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
        DEMAND_CREATED: { icon: '📋', text: 'Talep oluşturuldu', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
        MATCHED_TO_DEMAND: { icon: '🤝', text: 'Talebe eşleştirildi', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        QUERY: { icon: '🔍', text: 'Sorgu yapıldı', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
        AI_ANALYZED: { icon: '✨', text: 'AI analizi yapıldı', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    }[a] || { icon: '•', text: String(a || 'BİLİNMEYEN').toUpperCase(), color: 'text-gray-600 bg-gray-50 border-gray-200' });

    const translateStatus = (status) => {
        if (!status) return '(boş)';
        const map = {
            'approved': 'Onaylı',
            'pending': 'Onay Bekliyor',
            'deleted': 'Çöp Kutusu',
            'matched': 'Eşleştirildi',
            'TKGM': 'TKGM Kayıtları',
            'AI_Analyzed': 'AI Analizli'
        };
        return map[status] || status;
    };

    // Group logs by day
    const groupedLogs = logs.reduce((acc, log) => {
        const d = new Date(log.timestamp);
        const dateKey = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(log);
        return acc;
    }, {});

    return (
        <div className="animate-fade-in-up pb-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Aktivite Geçmişi</h2>
                    <p className="text-gray-500 font-medium">
                        {user?.role === 'admin' ? 'Tüm kullanıcıların sistem üzerindeki geçmiş işlemleri.' : 'Kendi yaptığınız son işlemler ve değişiklikler.'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : Object.keys(groupedLogs).length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
                    <div className="text-gray-300 mb-4 inline-block bg-gray-50 p-6 rounded-full">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Henüz Aktivite Yok</h3>
                    <p className="text-gray-500">Sistemde kayıtlı herhangi bir işlem geçmişi bulunmuyor.</p>
                </div>
            ) : (
                <div className="space-y-10 border-l-2 border-indigo-100 ml-4 pl-8 py-2 relative">
                    {Object.entries(groupedLogs).map(([date, dayLogs], idx) => (
                        <div key={date} className="relative">
                            <div className="absolute -left-11 mt-1.5 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center border-4 border-gray-50 shadow-sm">
                                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span>
                            </div>
                            <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-6 bg-indigo-50 inline-block px-4 py-1.5 rounded-full shadow-sm border border-indigo-100/50">
                                {date}
                            </h3>

                            <div className="space-y-5">
                                {dayLogs.map((log) => {
                                    const { icon, text, color } = actionLabel(log.action);
                                    return (
                                        <div key={log.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center">

                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600 font-bold text-sm shadow-inner">
                                                    {log.by ? log.by[0].toUpperCase() : 'S'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                                        <span>{log.by}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md border ${color}`}>
                                                            {icon} {text}
                                                        </span>
                                                    </p>
                                                    <div className="text-sm text-gray-600 flex flex-wrap items-center gap-2">
                                                        {log.action === 'listing_deleted' || log.action === 'hard_deleted' ? (
                                                            <span className="font-semibold text-gray-800 line-through decoration-red-400">{log.listingTitle || 'İsimsiz İlan'}</span>
                                                        ) : (
                                                            <Link to="/sayfalar/kaydedilenler" className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1">
                                                                {log.listingTitle || 'İsimsiz İlan'}
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                            </Link>
                                                        )}
                                                        <span className="text-gray-400 font-medium">üzerinde işlem yaptı.</span>
                                                    </div>

                                                    {log.from !== null && log.to !== null && String(log.from) !== String(log.to) && (
                                                        <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3 inline-flex flex-wrap items-center gap-3 text-sm">
                                                            <span className="line-through text-gray-400 max-w-xs truncate" title={String(log.from || '(boş)')}>
                                                                {log.action === 'status_changed' ? translateStatus(log.from) : String(log.from || '(boş)')}
                                                            </span>
                                                            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                            <span className="font-semibold text-gray-700 max-w-xs break-words">
                                                                {log.action === 'status_changed' ? translateStatus(log.to) : String(log.to || '(boş)')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-xs text-gray-400 font-bold tracking-wide whitespace-nowrap bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex-shrink-0 flex items-center gap-1.5 md:ml-auto">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ActivityFeed;
