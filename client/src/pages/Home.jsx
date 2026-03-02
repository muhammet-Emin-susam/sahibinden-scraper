import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function Home() {
    const { token, user } = useContext(AuthContext);
    const [stats, setStats] = useState({
        total: 0,
        today: 0,
        pending: 0,
        approved: 0,
        analyzed: 0
    });
    const [recentRecords, setRecentRecords] = useState([]);
    const [loading, setLoading] = useState(true);

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
                const response = await fetch('/api/records', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
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

                    setStats({
                        total: records.length,
                        today: todayCount,
                        pending: pendingCount,
                        approved: approvedCount,
                        analyzed: analyzedCount
                    });

                    // Sort by scrapedAt descending and take top 5
                    const sorted = [...records].sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
                    setRecentRecords(sorted.slice(0, 5));
                }
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium">Dashboard hazırlanıyor...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Hoşgeldin, {user?.displayName || user?.username} 👋</h1>
                    </div>
                    <p className="text-gray-500 ml-16 font-medium">Emlak yönetim panelinde bugün neler var? İşte genel durumun özeti.</p>
                </div>

                {/* Weather and Time Widget */}
                <div className="flex items-stretch gap-3 bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 flex-shrink-0 animate-fade-in">
                    <div className="flex flex-col justify-center px-4 border-r border-gray-100">
                        <span className="text-2xl font-black text-gray-900 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-500">
                            {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                            {currentTime.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 px-3">
                        <div className="text-3xl filter drop-shadow-sm">{weather.icon || '⌛'}</div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <span className="text-lg font-black text-gray-800 leading-tight">
                                    {weather.temp !== null ? `${weather.temp}°` : '--°'}
                                </span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                    {localStorage.getItem('efdal_weather_city') || 'İstanbul'}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {weather.condition || 'Yükleniyor'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 group hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors duration-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-blue-600">Genel</span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.total}</div>
                        <h3 className="text-gray-500 font-medium text-sm">Toplam İlan</h3>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 group hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-100 transition-colors duration-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-amber-500">Bekleyen</span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.pending}</div>
                        <h3 className="text-gray-500 font-medium text-sm">Onay Bekleyenler</h3>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 group hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-100 transition-colors duration-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-emerald-500">Aktif</span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.approved}</div>
                        <h3 className="text-gray-500 font-medium text-sm">Onaylı Portföy</h3>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 group hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors duration-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-indigo-600">Zeka</span>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-900 mb-1">{stats.analyzed}</div>
                        <h3 className="text-gray-500 font-medium text-sm">EfdalAI Analizleri</h3>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-10">
                {/* Recent Items Section */}
                <div className="lg:col-span-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                            Son Eklenen İlanlar
                        </h2>
                        <Link to="/sayfalar/kaydedilenler" className="text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors">Tümünü Gör</Link>
                    </div>
                    <div className="space-y-4">
                        {recentRecords.map((record) => (
                            <div key={record.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 hover:border-blue-200 transition-all shadow-sm group">
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100">
                                    {record.images?.[0] ? (
                                        <img src={record.images[0]} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-800 truncate leading-tight uppercase text-sm group-hover:text-blue-600 transition-colors">{record.title}</h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            {new Date(record.scrapedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{record.price}</span>
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    {record.status === 'pending' ? (
                                        <span className="px-3 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-amber-200">BEKLİYOR</span>
                                    ) : (
                                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-200">ONAYLI</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Integration Promo */}
                <div className="lg:col-span-4">
                    <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white rounded-[2.5rem] p-8 relative overflow-hidden shadow-xl shadow-indigo-200  flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl mix-blend-overlay"></div>
                        <div className="relative z-10">
                            <span className="bg-white/20 backdrop-blur-sm text-white border border-white/20 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-4 inline-block">Yapay Zeka Destekli</span>
                            <h2 className="text-2xl font-black mb-4 leading-tight">Yapay Zeka ile İlanlarınızı Analiz Edin</h2>
                            <p className="text-indigo-100 text-sm leading-relaxed mb-6 font-medium">
                                Kaydettiğiniz ilanları EfdalAI ile inceleyerek mülk sahibi ikna stratejilerini ve portföy potansiyelini anında öğrenin.
                            </p>
                        </div>
                        <div className="relative z-10">
                            <Link to="/efdal-ai" className="flex items-center justify-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg shadow-black/5 font-bold py-4 px-6 rounded-2xl transition-all group">
                                EfdalAI'ya Git
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
