import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';



function Home() {
    const navigate = useNavigate();
    const { token, user } = useContext(AuthContext);
    const [stats, setStats] = useState({
        total: 0,
        today: 0,
        pending: 0,
        approved: 0,
        analyzed: 0,
        activityData: []
    });
    const [recentRecords, setRecentRecords] = useState([]);
    const [followUps, setFollowUps] = useState({ day2: [], day7: [], day25: [] });
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showReleaseNotes, setShowReleaseNotes] = useState(false);

    // Weather and Time State
    const [currentTime, setCurrentTime] = useState(new Date());
    const [weather, setWeather] = useState({ temp: null, condition: null, icon: null });

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Weather Fetch
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Pre-defined coordinates list to match with settings
                const cities = {
                    'Adana': { lat: 37.0000, lon: 35.3213 },
                    'Ankara': { lat: 39.9334, lon: 32.8597 },
                    'Antalya': { lat: 36.8969, lon: 30.7133 },
                    'Bursa': { lat: 40.1828, lon: 29.0667 },
                    'Diyarbakır': { lat: 37.9144, lon: 40.2306 },
                    'Erzurum': { lat: 39.9000, lon: 41.2700 },
                    'Eskişehir': { lat: 39.7767, lon: 30.5206 },
                    'Gaziantep': { lat: 37.0662, lon: 37.3833 },
                    'İstanbul': { lat: 41.0138, lon: 28.9497 },
                    'İzmir': { lat: 38.4127, lon: 27.1384 },
                    'Kayseri': { lat: 38.7312, lon: 35.4787 },
                    'Konya': { lat: 37.8667, lon: 32.4833 },
                    'Mersin': { lat: 36.8000, lon: 34.6333 },
                    'Samsun': { lat: 41.2867, lon: 36.3300 },
                    'Trabzon': { lat: 41.0050, lon: 39.7269 }
                };

                const savedCity = localStorage.getItem('efdal_weather_city') || 'İstanbul';
                const coords = cities[savedCity] || cities['İstanbul'];

                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`);
                const data = await res.json();
                if (data && data.current_weather) {
                    const temp = Math.round(data.current_weather.temperature);
                    const code = data.current_weather.weathercode;
                    // WMO Weather interpretation codes
                    let condition = 'Açık';
                    let icon = '☀️';
                    if (code >= 1 && code <= 3) { condition = 'Parçalı Bulutlu'; icon = '⛅'; }
                    else if (code >= 45 && code <= 48) { condition = 'Sisli'; icon = '🌫️'; }
                    else if (code >= 51 && code <= 67) { condition = 'Yağmurlu'; icon = '🌧️'; }
                    else if (code >= 71 && code <= 77) { condition = 'Karlı'; icon = '❄️'; }
                    else if (code >= 80 && code <= 82) { condition = 'Sağanak Yağışlı'; icon = '🌦️'; }
                    else if (code >= 95 && code <= 99) { condition = 'Fırtınalı'; icon = '⛈️'; }

                    setWeather({ temp, condition, icon });
                }
            } catch (error) {
                console.error("Weather fetch failed", error);
            }
        };
        fetchWeather();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const [recordsRes, appRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/records`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/appointments`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);
                const result = await recordsRes.json();
                const appResult = await appRes.json();

                if (result.success) {
                    // Exclude deleted records from dashboard metrics
                    const records = result.data.filter(r => r.status !== 'deleted');
                    const now = new Date();
                    const todayStr = now.toISOString().slice(0, 10);

                    const todayCount = records.filter(r => {
                        try {
                            return new Date(r.scrapedAt).toISOString().slice(0, 10) === todayStr;
                        } catch (e) { return false; }
                    }).length;

                    const pendingCount = records.filter(r => r.status === 'pending').length;
                    const approvedCount = records.filter(r => r.status === 'approved' || !r.status).length;
                    const analyzedCount = records.filter(r => r.aiAnalysis).length;

                    // Calculate last 7 days activity
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d.toISOString().slice(0, 10);
                    });

                    const activityCounts = last7Days.map(dateStr => {
                        return records.filter(r => {
                            try {
                                return new Date(r.scrapedAt).toISOString().slice(0, 10) === dateStr;
                            } catch (e) { return false; }
                        }).length;
                    });

                    setStats({
                        total: records.length,
                        today: todayCount,
                        pending: pendingCount,
                        approved: approvedCount,
                        analyzed: analyzedCount,
                        activityData: activityCounts
                    });

                    // Sort by scrapedAt descending and take top 5
                    const sorted = [...records].sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
                    setRecentRecords(sorted.slice(0, 5));

                    // Follow-ups calculation
                    const activeStatuses = ['Arandı', 'Ulaşılamadı', 'Düşünülecek'];
                    const d2 = [], d7 = [], d25 = [];
                    records.forEach(r => {
                        if (activeStatuses.includes(r.status_tag) && r.arandiAt) {
                            const diffDays = Math.floor((now - new Date(r.arandiAt)) / 86400000);
                            if (diffDays >= 25 && diffDays < 40) d25.push({ ...r, diffDays }); // don't show after 40 days
                            else if (diffDays >= 7 && diffDays < 25) d7.push({ ...r, diffDays });
                            else if (diffDays >= 2 && diffDays < 7) d2.push({ ...r, diffDays });
                        }
                    });
                    setFollowUps({ day2: d2, day7: d7, day25: d25 });
                }

                if (appResult.success) {
                    const apps = appResult.data;
                    const now = new Date();
                    const nowStr = now.toDateString();

                    const todayApps = apps.filter(app => {
                        if (app.appointmentDate) {
                            return new Date(app.appointmentDate).toDateString() === nowStr;
                        }
                        return false;
                    });
                    todayApps.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
                    setTodayAppointments(todayApps);
                }
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Check for release notes - Bumped version to 5.0
        const currentVersion = '5.0';
        const lastSeen = localStorage.getItem('efdal_update_seen');
        if (lastSeen !== currentVersion) {
            setTimeout(() => setShowReleaseNotes(true), 1500);
        }
    }, [token]);

    const closeReleaseNotes = () => {
        localStorage.setItem('efdal_update_seen', '5.0');
        setShowReleaseNotes(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium">Dashboard hazırlanıyor...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto h-full px-2">
            {/* Minimalist Top Header */}
            <header className="mb-10 flex flex-col md:flex-row items-end justify-between gap-6 pb-6 border-b border-gray-100">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Hoşgeldin, {user?.displayName || user?.username} 👋</h1>
                    {/* The new thin status bar */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-600">
                        <span className="bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 hover:border-blue-200 transition-colors">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Aylık Hedef İlan Havuzu: <strong className="text-gray-900 text-sm ml-1">{stats.total}</strong>
                        </span>
                        <span className="bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 hover:border-amber-200 transition-colors">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Bekleyenler: <strong className="text-gray-900 text-sm ml-1">{stats.pending}</strong>
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-full flex items-center gap-2 border border-emerald-100 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Aktif Yayında: <strong className="text-emerald-900 text-sm ml-1">{stats.approved}</strong>
                        </span>
                    </div>
                </div>

                {/* Weather and Time Widget (Minimal) */}
                <div className="flex items-center gap-4 bg-transparent mb-2">
                    <div className="text-right">
                        <div className="text-2xl font-black text-gray-800 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-br from-gray-800 to-gray-500">
                            {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400  tracking-widest mt-1">
                            {currentTime.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                    </div>
                    <div className="w-px h-10 bg-gray-200"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl drop-shadow-sm">{weather.icon || '⌛'}</span>
                        <span className="text-sm font-black text-gray-800 mt-1">{weather.temp !== null ? `${weather.temp}°` : '--°'}</span>
                    </div>
                </div>
            </header>

            {/* ACTION CENTER - The Hero Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 relative">
                <div className="absolute left-1/2 top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent hidden lg:block -translate-x-1/2"></div>

                {/* Sol Kolon: Bugünün Randevuları */}
                <div className="animate-fade-in-up md:pr-4" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-sm font-normal tracking-widest text-indigo-900 flex items-center gap-1">
                            <span className="relative flex h-3 w-3">
                                <span className={todayAppointments.length > 0 ? "animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" : ""}></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                            </span>
                            Bugünün Etkileşimleri
                        </span>
                        <div className="h-px bg-indigo-100 flex-1"></div>
                        {todayAppointments.length > 0 && <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-black border border-indigo-100">{todayAppointments.length} GÖRÜŞME</span>}
                    </div>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        {todayAppointments.map(app => (
                            <div key={app.id} className="bg-white p-5 rounded-3xl shadow-[0_2px_15px_-3px_rgba(6,81,237,0.05)] border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all group relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-3xl"></div>
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[15px] font-black text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{app.customerName || 'İsimsiz Müşteri'}</h4>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 font-medium">
                                            <span className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg font-bold border border-indigo-100/50">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                {new Date(app.appointmentDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {app.status && <span className="bg-gray-100 px-2.5 py-1.5 rounded-lg text-gray-600 font-bold">{app.status}</span>}
                                        </div>
                                    </div>
                                    {app.customerPhone && (
                                        <a href={`tel:${app.customerPhone}`} className="w-12 h-12 rounded-[1.25rem] bg-gray-50 text-indigo-600 flex justify-center items-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-md transition-all hover:scale-105" title="Ara">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                        </a>
                                    )}
                                </div>
                                {app.quotedListing && (
                                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-3 cursor-pointer group/link" onClick={() => navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: app.quotedListing.id } })}>
                                        <div className="text-[10px] bg-gray-50 text-gray-400 px-2 py-1.5 rounded-lg font-black tracking-widest  flex-shrink-0 group-hover/link:bg-indigo-50 group-hover/link:text-indigo-600 transition-colors border border-transparent group-hover/link:border-indigo-100">İLGİLİ İLAN</div>
                                        <span className="text-xs font-bold text-gray-600 group-hover/link:text-indigo-600 transition-colors truncate flex-1">{app.quotedListing.title}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {todayAppointments.length === 0 && (
                            <div className="border border-dashed border-gray-200 bg-white/40 rounded-3xl p-10 flex flex-col items-center justify-center text-center opacity-80 min-h-[200px]">
                                <div className="w-16 h-16 bg-gray-100/50 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <p className="text-xs font-normal  tracking-widest text-gray-400 mb-4">Planlı Etkileşim Yok</p>
                                <button onClick={() => navigate('/sayfalar/randevular')} className="text-[11px] font-black  text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-full transition-colors">Randevu Oluştur</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sağ Kolon: Yaklaşan Takipler */}
                <div className="animate-fade-in-up md:pl-4" style={{ animationDelay: '300ms' }}>
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-sm font-normal  tracking-widest text-red-900 flex items-center gap-1">
                            <span className="relative flex h-3 w-3">
                                <span className={(followUps.day2.length + followUps.day7.length + followUps.day25.length) > 0 ? "animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" : ""}></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            Hatırlatmalar & Takipler
                        </span>
                        <div className="h-px bg-red-100 flex-1"></div>
                        {(followUps.day2.length + followUps.day7.length + followUps.day25.length) > 0 && <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black border border-red-100">{followUps.day2.length + followUps.day7.length + followUps.day25.length} BEKLEYEN</span>}
                    </div>

                    <div className="space-y-8 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">

                        {/* If ALL follow ups are empty */}
                        {(followUps.day2.length === 0 && followUps.day7.length === 0 && followUps.day25.length === 0) ? (
                            <div className="border border-dashed border-gray-200 bg-white/40 rounded-3xl p-10 flex flex-col items-center justify-center text-center opacity-80 min-h-[200px]">
                                <div className="w-16 h-16 bg-gray-100/50 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <p className="text-xs font-normal  tracking-widest text-gray-400 mb-2">Tüm Takipler Güncel</p>
                                <p className="text-[10px] text-gray-400 font-medium">Şu an için bekleyen arama yok.</p>
                            </div>
                        ) : (
                            <>
                                {/* 2. Gün */}
                                {followUps.day2.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-black  text-gray-500 mb-3 flex items-center gap-2 tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div> 2. Gün Aramaları
                                        </h4>
                                        <div className="space-y-3">
                                            {followUps.day2.map(r => (
                                                <div key={r.id} onClick={() => navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: r.id } })} className="bg-white p-4 rounded-3xl shadow-[0_2px_15px_-3px_rgba(249,115,22,0.05)] border border-gray-100 cursor-pointer hover:border-orange-200 hover:shadow-lg transition-all group flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-black text-gray-800 truncate group-hover:text-orange-600 transition-colors leading-tight">{r.title}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="bg-gray-50 text-gray-500 text-[10px]  font-bold px-2.5 py-1 rounded-lg border border-gray-100">{r.status_tag}</span>
                                                        <span className="text-orange-700 font-black text-xs bg-orange-50/80 px-3 py-1.5 rounded-lg border border-orange-100/50">{r.diffDays} Gün</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 7. Gün */}
                                {followUps.day7.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-black  text-gray-500 mb-3 flex items-center gap-2 tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> 7. Gün Aramaları
                                        </h4>
                                        <div className="space-y-3">
                                            {followUps.day7.map(r => (
                                                <div key={r.id} onClick={() => navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: r.id } })} className="bg-white p-4 rounded-3xl shadow-[0_2px_15px_-3px_rgba(59,130,246,0.05)] border border-gray-100 cursor-pointer hover:border-blue-200 hover:shadow-lg transition-all group flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-black text-gray-800 truncate group-hover:text-blue-600 transition-colors leading-tight">{r.title}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="bg-gray-50 text-gray-500 text-[10px]  font-bold px-2.5 py-1 rounded-lg border border-gray-100">{r.status_tag}</span>
                                                        <span className="text-blue-700 font-black text-xs bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-100/50">{r.diffDays} Gün</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 25. Gün */}
                                {followUps.day25.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-black  text-gray-500 mb-3 flex items-center gap-2 tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div> 25. Gün Aramaları
                                        </h4>
                                        <div className="space-y-3">
                                            {followUps.day25.map(r => (
                                                <div key={r.id} onClick={() => navigate('/sayfalar/kaydedilenler', { state: { expandRecordId: r.id } })} className="bg-white p-4 rounded-3xl shadow-[0_2px_15px_-3px_rgba(168,85,247,0.05)] border border-gray-100 cursor-pointer hover:border-purple-200 hover:shadow-lg transition-all group flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-black text-gray-800 truncate group-hover:text-purple-600 transition-colors leading-tight">{r.title}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="bg-gray-50 text-gray-500 text-[10px]  font-bold px-2.5 py-1 rounded-lg border border-gray-100">{r.status_tag}</span>
                                                        <span className="text-purple-700 font-black text-xs bg-purple-50/80 px-3 py-1.5 rounded-lg border border-purple-100/50">{r.diffDays} Gün</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

            </div>

            {/* Yatay Son Eklenen İlanlar (Horizontal Collection) */}
            <div className="animate-fade-in-up mt-10 p-6 bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white shadow-sm" style={{ animationDelay: '400ms' }}>
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                        Ağa Takılan Son İlanlar
                    </h2>
                    <Link to="/sayfalar/kaydedilenler" className="text-[10px] font-normal  tracking-widest text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full transition-colors flex items-center gap-2">
                        Tümü <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </Link>
                </div>

                {recentRecords.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {recentRecords.slice(0, 4).map((record) => (
                            <Link key={record.id} to="/sayfalar/kaydedilenler" state={{ expandRecordId: record.id }} className="bg-white rounded-[1.5rem] p-3 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group block relative overflow-hidden">
                                <div className="h-40 rounded-xl overflow-hidden bg-gray-50 mb-4 relative">
                                    {record.images?.[0] ? (
                                        <img src={record.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col gap-2 items-center justify-center text-gray-300">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent"></div>
                                    <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                                        {record.status === 'pending' ? (
                                            <span className="bg-amber-500/90 text-white backdrop-blur-md text-[9px] font-black  px-2 py-1 rounded shadow-sm tracking-wider">Geliştiriliyor</span>
                                        ) : (
                                            <span className="bg-emerald-500/90 text-white backdrop-blur-md text-[9px] font-black  px-2 py-1 rounded shadow-sm tracking-wider">İşlemde</span>
                                        )}
                                        {record.aiAnalysis && (
                                            <span className="bg-purple-500/90 text-white backdrop-blur-md text-[9px] font-black  px-2 py-1 rounded shadow-sm tracking-wider flex items-center gap-1">
                                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"></path></svg> EfdalAI
                                            </span>
                                        )}
                                    </div>
                                    <div className="absolute bottom-3 left-3 right-3">
                                        <h3 className="font-extrabold text-white text-sm truncate drop-shadow-md">{record.title}</h3>
                                    </div>
                                </div>
                                <div className="px-2 pb-2">
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="text-lg font-black text-indigo-700">{record.price}</div>
                                        <span className="text-[10px] text-gray-400 font-bold ">{new Date(record.scrapedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="border border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center opacity-60">
                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        </div>
                        <p className="text-[11px] font-bold  text-gray-400 tracking-widest">Sistemde Bekleyen Veri Yok</p>
                    </div>
                )}
            </div>

            {/* ONE-TIME RELEASE NOTES MODAL */}
            {showReleaseNotes && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-fade-in">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeReleaseNotes}></div>

                    {/* Modal Content */}
                    <div className="relative bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/40 overflow-hidden animate-in zoom-in-95 duration-500">
                        {/* Hero Section */}
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 md:p-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white"></path>
                                </svg>
                            </div>
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl mb-4 shadow-xl border border-white/20">
                                <span className="text-2xl">🚀</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-1">Yenilikler Yayında!</h2>
                            <p className="text-white/70 font-semibold uppercase tracking-widest text-[9px]">Efdal Dashboard v5.0 Güncellemesi</p>
                        </div>

                        <div className="p-6 md:p-8 space-y-6">
                            <div className="grid gap-5">
                                {/* Feature 1 */}
                                <div className="flex gap-4 group">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 transition-all duration-300">
                                        <svg className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-[15px] mb-0.5">Gelişmiş Fotoğraf Galerisi</h4>
                                        <p className="text-[13px] text-gray-500 font-medium leading-normal">Thumbnail destekli ve hızlı geçişli yeni galeri arayüzü yayına alındı.</p>
                                    </div>
                                </div>

                                {/* Feature 2 */}
                                <div className="flex gap-4 group">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-all duration-300">
                                        <svg className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-[15px] mb-0.5">Akıllı Zoom & Pan</h4>
                                        <p className="text-[13px] text-gray-500 font-medium leading-normal">Detayları inceleyebilmeniz için hassas yakınlaştırma özelliği eklendi.</p>
                                    </div>
                                </div>

                                {/* Feature 3 */}
                                <div className="flex gap-4 group">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-all duration-300">
                                        <svg className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-[15px] mb-0.5">Global Bildirim Sistemi</h4>
                                        <p className="text-[13px] text-gray-500 font-medium leading-normal">Tüm sistem uyarıları için modern bir bildirim altyapısı entegre edildi.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Past Improvements Expanded Section */}
                            <div className="pt-6 border-t border-gray-100 space-y-4">
                                <h5 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-3 ml-1">Geçmiş İyileştirmeler</h5>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 px-1">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                            <span className="text-[13px] font-semibold text-gray-800">Veri & Mantık Hataları</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-medium leading-snug pl-3.5">Senkronizasyon ve gecikme sorunları tamamen giderildi.</p>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            <span className="text-[13px] font-semibold text-gray-800">Gelişmiş Raporlama</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-medium leading-snug pl-3.5">Yeni filtreleme ile Excel aktarımı daha esnek hale getirildi.</p>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                            <span className="text-[13px] font-semibold text-gray-800">Arayüz Modernizasyonu</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-medium leading-snug pl-3.5">Takip Zinciri ve Talep Bölgeleri sayfaları yenilendi.</p>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                            <span className="text-[13px] font-semibold text-gray-800">Altyapı & Hız</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-medium leading-snug pl-3.5">Sorgu süreleri ve render performansı optimize edildi.</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={closeReleaseNotes}
                                className="w-full bg-indigo-600 hover:bg-black text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-indigo-100 transition-all active:scale-98 text-base"
                            >
                                Harika, Anladım! ✨
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;
