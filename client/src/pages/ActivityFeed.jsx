import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';


function ActivityFeed() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token, user } = useContext(AuthContext);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${API_BASE_URL}/activity`, {
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

    // Group logs by day
    const groupedLogs = logs.reduce((acc, log) => {
        const d = new Date(log.timestamp);
        const dateKey = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(log);
        return acc;
    }, {});

    return (
        <div className="animate-fade-in-up pb-10 max-w-5xl mx-auto px-4 sm:px-6">
            {/* Header section with floating feel */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 pt-4">
                <div>
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        Aktivite Geçmişi
                    </h2>
                    <p className="text-slate-500 font-medium text-lg max-w-2xl leading-relaxed">
                        {user?.role === 'admin' 
                            ? 'Tüm kullanıcıların sistem üzerindeki geçmiş işlemleri ve güncel aktivite akışı.' 
                            : 'Kendi yaptığınız son işlemler ve sistem üzerindeki değişikliklerinizin özeti.'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full animate-spin border-t-transparent"></div>
                    </div>
                    <span className="text-slate-400 font-bold tracking-widest uppercase text-xs">Yükleniyor...</span>
                </div>
            ) : Object.keys(groupedLogs).length === 0 ? (
                <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white p-20 text-center">
                    <div className="text-slate-300 mb-6 inline-flex bg-slate-50 w-24 h-24 items-center justify-center rounded-3xl shadow-inner">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">Henüz Aktivite Yok</h3>
                    <p className="text-slate-500 max-w-sm mx-auto font-medium">Sistemde henüz kayıtlı herhangi bir işlem geçmişi bulunmuyor.</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Continuous vertical line for the timeline */}
                    <div className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-indigo-100 via-indigo-50 to-transparent md:left-[23px]"></div>

                    <div className="space-y-16">
                        {Object.entries(groupedLogs).map(([date, dayLogs], idx) => (
                            <div key={date} className="relative">
                                {/* Date indicator with glass background */}
                                <div className="sticky top-6 z-20 mb-8 ml-0 md:ml-0 flex items-center">
                                    <div className="w-12 h-12 bg-white border-4 border-slate-50 rounded-full flex items-center justify-center shadow-md shadow-indigo-100/50 z-10 shrink-0">
                                        <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="ml-6 flex items-center">
                                        <div className="bg-indigo-600/10 backdrop-blur-md border border-indigo-200/50 px-5 py-2 rounded-2xl shadow-sm">
                                            <span className="text-sm font-black text-indigo-700 uppercase tracking-[0.2em]">
                                                {date}
                                            </span>
                                        </div>
                                        <div className="ml-3 h-[1px] w-24 bg-gradient-to-r from-indigo-100 to-transparent hidden sm:block"></div>
                                    </div>
                                </div>

                                <div className="space-y-6 ml-6 md:ml-6 pl-12 border-l-0">
                                    {dayLogs.map((log) => {
                                        const { icon, text, color } = actionLabel(log.action);
                                        return (
                                            <div 
                                                key={log.id} 
                                                className="group relative bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-indigo-100/50 hover:-translate-y-1 hover:border-indigo-100 transition-all duration-500 flex flex-col sm:flex-row gap-6 items-start"
                                            >
                                                {/* Action Icon on the card */}
                                                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shadow-inner group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors duration-500">
                                                    {icon}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex -space-x-2">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-400 border-2 border-white flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                                                                    {log.by ? log.by[0].toUpperCase() : 'S'}
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-800 tracking-tight">{log.by}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className={`text-[9px] uppercase font-black px-2.5 py-1 rounded-lg border shadow-sm ${color} group-hover:shadow-indigo-100 transition-all`}>
                                                                {text}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-bold group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600 transition-all">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>

                                                    <div className="mb-4">
                                                        <div className="flex items-start gap-2 text-[15px] text-slate-600 font-medium leading-relaxed overflow-hidden">
                                                            {log.action === 'listing_deleted' || log.action === 'hard_deleted' ? (
                                                                <span className="font-extrabold text-slate-900 line-through decoration-red-400 decoration-2 decoration-slice">{log.listingTitle || 'İsimsiz İlan'}</span>
                                                            ) : (
                                                                <Link 
                                                                    to="/sayfalar/kaydedilenler" 
                                                                    state={{ expandRecordId: log.listingId }} 
                                                                    className="font-extrabold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-2 group/link"
                                                                >
                                                                    <span className="relative">
                                                                        {log.listingTitle || 'İsimsiz İlan'}
                                                                        <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 group-hover/link:w-full transition-all duration-300"></span>
                                                                    </span>
                                                                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center opacity-0 group-hover/link:opacity-100 transform translate-x-1 group-hover/link:translate-x-0 transition-all">
                                                                        <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                    </div>
                                                                </Link>
                                                            )}
                                                            <span className="text-slate-400 font-semibold opacity-70">üzerinde işlem yaptı.</span>
                                                        </div>
                                                    </div>

                                                    {log.from !== null && log.to !== null && String(log.from) !== String(log.to) && (
                                                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-wrap items-center gap-4 group-hover:bg-indigo-50/30 group-hover:border-indigo-100/50 transition-colors duration-500">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-[10px] text-slate-400 font-bold border border-slate-100 line-through">
                                                                    {translateStatus(log.from)}
                                                                </div>
                                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                                </div>
                                                                <div className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-100 text-[11px] font-black tracking-wide border border-indigo-500">
                                                                    {translateStatus(log.to)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ActivityFeed;
