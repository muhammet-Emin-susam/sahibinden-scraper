import { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const EfdalAILink = ({ location, isExpanded }) => {
    const linkRef = useRef(null);

    const handleMouseMove = (e) => {
        if (!linkRef.current) return;
        const rect = linkRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        linkRef.current.style.setProperty('--mouse-x', `${x}px`);
        linkRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <Link
            ref={linkRef}
            to="/efdal-ai"
            title={!isExpanded ? "EfdalAI Akıllı Asistan" : undefined}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
                if (linkRef.current) {
                    linkRef.current.style.setProperty('--mouse-x', `-100px`);
                    linkRef.current.style.setProperty('--mouse-y', `-100px`);
                }
            }}
            className={`group relative flex items-center transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${location.pathname === '/efdal-ai' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''} ${isExpanded ? 'gap-3 py-3 px-4 min-h-[64px] rounded-2xl' : 'flex-col justify-center px-0 py-0 w-11 h-24 rounded-full mx-auto shadow-sm'}`}
            style={{ transform: 'translateZ(0)' }}
        >
            <div className={`absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity duration-300 ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`}></div>

            {/* Glowing circle following mouse */}
            <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none mix-blend-screen ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`}
                style={{
                    background: 'radial-gradient(circle 80px at var(--mouse-x, -100px) var(--mouse-y, -100px), rgba(255,255,255,0.4), transparent 80%)'
                }}
            />

            {/* subtle dotted pattern overlay */}
            <div className={`absolute inset-0 opacity-10 ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`} style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>

            {/* Icon Container */}
            <div className={`relative z-10 flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'w-11 h-11 rounded-xl bg-white/20 shadow-inner backdrop-blur-md group-hover:scale-110' : 'w-full h-full group-hover:-translate-y-1'}`}>
                <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>

            {/* Text Content */}
            {isExpanded && (
                <div className="relative z-10 flex flex-col justify-center min-w-0">
                    <h3 className="font-black text-white text-[16px] tracking-tight leading-none drop-shadow-sm mb-1 text-shadow-sm">EfdalAI</h3>
                    <p className="text-[10px] font-bold text-white uppercase tracking-[0.15em] leading-none truncate opacity-90 transition-opacity">Akıllı Asistan</p>
                </div>
            )}
        </Link>
    );
};

const Layout = ({ children }) => {
    const { user, token, logout } = useContext(AuthContext);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [notification, setNotification] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef(null);
    const location = useLocation();
    const audioCtxRef = useRef(null);

    // Create AudioContext at mount; browsers start it suspended but we resume on interaction
    useEffect(() => {
        try {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { /* not supported */ }

        const unlock = () => {
            if (audioCtxRef.current?.state === 'suspended') {
                audioCtxRef.current.resume();
            }
        };
        window.addEventListener('click', unlock);
        window.addEventListener('keydown', unlock);

        // Handle clicking outside the settings dropdown
        const handleClickOutside = (event) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('click', unlock);
            window.removeEventListener('keydown', unlock);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Play a short two-tone ding — awaits resume so notes play reliably
    const playNotificationSound = () => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        (async () => {
            try {
                if (ctx.state === 'suspended') await ctx.resume();
                const notes = [880, 1100];
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    const t = ctx.currentTime + i * 0.13;
                    osc.frequency.setValueAtTime(freq, t);
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(0.45, t + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
                    osc.start(t);
                    osc.stop(t + 0.45);
                });
            } catch (e) { /* silently ignore */ }
        })();
    };

    // Helper function to render menu items
    const renderMenuItem = (to, iconPath, label, badgeCount = 0) => {
        const active = location.pathname === to;
        return (
            <Link key={to} to={to} className={`group relative flex items-center transition-all ${isSidebarExpanded ? 'py-2.5 px-4 gap-3 rounded-xl' : 'w-11 h-11 mx-auto justify-center rounded-[14px]'} ${active ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600 font-medium'}`} title={!isSidebarExpanded ? label : undefined}>
                <svg className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${!isSidebarExpanded && 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath}></path>
                </svg>
                {isSidebarExpanded && (
                    <>
                        <span className="whitespace-nowrap flex-1 truncate transition-all duration-300">
                            {label}
                        </span>
                        {badgeCount > 0 && (
                            <span className="bg-indigo-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight shadow-md border border-indigo-400 flex-shrink-0 ml-1 transition-transform duration-300">
                                {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                        )}
                    </>
                )}
                {!isSidebarExpanded && badgeCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white shadow-sm"></span>
                )}
            </Link>
        );
    };

    // Clear unread count when visiting announcements page
    useEffect(() => {
        if (location.pathname === '/sayfalar/duyurular' && user) {
            const storageKey = `efdal_last_seen_at_${user.id}`;
            localStorage.setItem(storageKey, new Date().toISOString());
            setUnreadCount(0);
        }
    }, [location.pathname, user]);

    // Shine animation for EfdalAI
    const pulseStyle = `
        @keyframes shine-pulse {
            0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0); }
            100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
        }
    `;

    // Notification Polling
    useEffect(() => {
        if (!token || !user) return;

        const storageKey = `efdal_last_seen_at_${user.id}`;

        const checkAnnouncements = async () => {
            try {
                const response = await fetch('/api/announcements', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (!data.success || !data.data.length) return;

                const lastSeenAt = localStorage.getItem(storageKey);
                const allAnn = data.data;
                const latest = allAnn[0];

                // Count how many announcements are newer than lastSeenAt
                const newOnes = lastSeenAt
                    ? allAnn.filter(a => new Date(a.createdAt) > new Date(lastSeenAt))
                    : allAnn;

                // Only update unread if not on announcements page
                if (location.pathname !== '/sayfalar/duyurular') {
                    setUnreadCount(newOnes.length);
                }

                // Show toast for the latest if it's new AND not already toasted
                const toastedKey = `efdal_toasted_ann_${user.id}`;
                const lastToastedId = localStorage.getItem(toastedKey);
                if (newOnes.length > 0 && newOnes[0].id === latest.id && lastToastedId !== latest.id) {
                    localStorage.setItem(toastedKey, latest.id);
                    setNotification(latest);
                    playNotificationSound();
                    setTimeout(() => setNotification(null), 10000);
                }

                // If no lastSeenAt yet, set it now (first visit - mark all as seen but still show badge)
                if (!lastSeenAt) {
                    // Don't mark as seen immediately — let user visit the page
                }
            } catch (err) {
                console.error('Notification poll error:', err);
            }
        };

        checkAnnouncements();
        const interval = setInterval(checkAnnouncements, 10000);
        return () => clearInterval(interval);
    }, [token, user]);

    return (
        <div className="h-screen overflow-hidden flex bg-gray-50 p-4 gap-4 box-border">
            {/* Sidebar */}
            <aside className={`${isSidebarExpanded ? 'w-64' : 'w-20'} transition-all duration-300 bg-white border border-gray-200 shadow-sm rounded-3xl flex flex-col hidden md:flex h-full z-40 flex-shrink-0 relative group/sidebar`}>
                <div className={`p-6 border-b ${isSidebarExpanded ? 'border-gray-100 h-[72px] flex items-center justify-between flex-shrink-0' : 'border-transparent flex flex-col items-center justify-center p-0 pt-6 pb-2 gap-5'}`}>
                    <h1 className={`text-xl font-black tracking-tight text-gray-900 flex items-center gap-2 overflow-hidden ${isSidebarExpanded ? '' : 'hidden'}`}>
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        </div>
                        {isSidebarExpanded && <span className="whitespace-nowrap">İlan<span className="text-blue-600">Yönetimi</span></span>}
                    </h1>
                    <button
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        className={`text-gray-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-gray-100 transition-colors ${isSidebarExpanded ? '' : ''}`}
                        title={isSidebarExpanded ? "Menüyü Daralt" : "Menüyü Genişlet"}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isSidebarExpanded ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            )}
                        </svg>
                    </button>
                    {!isSidebarExpanded && (
                        <div className="w-11 h-11 bg-blue-600 rounded-[14px] flex items-center justify-center text-white shadow-md flex-shrink-0 cursor-pointer hover:scale-105 transition-transform border border-blue-500" title="İlan Yönetimi" onClick={() => setIsSidebarExpanded(true)}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        </div>
                    )}
                </div>

                <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
                    {isSidebarExpanded && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3 mt-2 whitespace-nowrap">Menü</div>}

                    {renderMenuItem('/home', 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', 'Anasayfa')}

                    {user?.role !== 'admin' && (
                        renderMenuItem('/sayfalar/onay-bekleyenler', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'Onay Bekleyenler')
                    )}

                    {renderMenuItem('/sayfalar/kaydedilenler', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', 'Kaydedilenler')}

                    {renderMenuItem('/sayfalar/arsiv', 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', 'Arşiv')}

                    {renderMenuItem('/sayfalar/koleksiyonlar', 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', 'Koleksiyonlarım')}

                    {renderMenuItem('/sayfalar/silinenler', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', 'Silinen İlanlar')}

                    {user?.role !== 'admin' && (
                        <>
                            {renderMenuItem('/sayfalar/talepler', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', 'Müşteri Talepleri')}
                            {renderMenuItem('/sayfalar/randevular', 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', 'Randevular')}
                        </>
                    )}

                    {renderMenuItem('/sayfalar/bolgeler', 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', 'Bölgeler')}

                    {renderMenuItem('/sayfalar/aktivite', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'Aktivite Geçmişi')}

                    {renderMenuItem('/sayfalar/duyurular', 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', 'Duyurular', unreadCount)}

                    <style>{pulseStyle}</style>
                    <div className="mt-4 mb-2 flex justify-center">
                        <EfdalAILink location={location} isExpanded={isSidebarExpanded} />
                    </div>

                    {user?.role === 'admin' && (
                        <>
                            {isSidebarExpanded && <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-4 mb-2 px-3 border-t border-gray-100/50 pt-4 whitespace-nowrap">Yönetim</div>}
                            {!isSidebarExpanded && <div className="mt-4 mb-2 border-t border-gray-100/50 pt-4"></div>}
                            {renderMenuItem('/admin', 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', 'Admin Paneli')}
                        </>
                    )}
                </div>

                <div className={`p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2 relative rounded-b-3xl ${isSidebarExpanded ? '' : 'items-center'}`} ref={settingsRef}>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-[14px] bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg flex-shrink-0 cursor-pointer transition-transform hover:scale-105 shadow-sm border border-blue-50" onClick={() => !isSidebarExpanded && setShowSettings(!showSettings)} title={!isSidebarExpanded ? 'Ayarlar' : undefined}>
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        {isSidebarExpanded && (
                            <>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.displayName || 'Kullanıcı'}</p>
                                    <p className="text-xs text-blue-600 font-medium truncate">{user?.role === 'admin' ? 'Yönetici' : 'Danışman'}</p>
                                </div>
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </button>
                            </>
                        )}
                    </div>

                    {showSettings && (
                        <div className={`absolute bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up z-50 flex flex-col p-2 space-y-1 ${isSidebarExpanded ? 'bottom-full left-4 right-4 mb-2 origin-bottom' : 'bottom-0 left-full ml-4 w-48 origin-bottom-left'}`}>
                            <Link to="/ayarlar" onClick={() => setShowSettings(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                Ayarlar
                            </Link>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { setShowSettings(false); logout(); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                Çıkış Yap
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-white shadow-sm rounded-3xl border border-gray-200">
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto p-4 md:p-8">
                        {children}
                    </div>
                </div>
            </main>

            {/* Notification Toast */}
            {notification && (
                <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-white/95 border border-indigo-100 rounded-2xl shadow-xl p-3 w-72 md:w-80 flex gap-3 backdrop-blur-sm">
                        {notification.imageUrl ? (
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 animate-pulse border border-gray-100">
                                <img src={notification.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white flex-shrink-0 animate-pulse">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${notification.type === 'Müşteri Talebi' ? 'text-orange-600' : 'text-indigo-600'}`}>{notification.type || 'Duyuru'}</span>
                                <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 truncate">{notification.title}</h4>
                            <p className="text-xs text-gray-500 line-clamp-1 break-words leading-tight">{notification.content}</p>
                            <Link
                                to="/sayfalar/duyurular"
                                onClick={() => setNotification(null)}
                                className="mt-1.5 inline-block text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase"
                            >
                                GÖSTER →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
