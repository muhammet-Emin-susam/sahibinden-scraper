import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function Regions() {
    const { showToast, showAlert } = useNotification();
    const { token, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [ilceler, setIlceler] = useState(null);
    const [mahalleler, setMahalleler] = useState(null);
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('Tümü');
    const [showOnlyMine, setShowOnlyMine] = useState(false);

    const [assignments, setAssignments] = useState([]);
    const [users, setUsers] = useState([]);
    const [modalData, setModalData] = useState(null); // { ilce, mahalle }

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        // Fetch geojson file from public folder
        fetch(`${import.meta.env.BASE_URL}konya_mahalleler.geojson`)
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => {
                setMahalleler(data);
                // Extract unique districts
                const uniqueDistricts = [...new Set(
                    data.features
                        .filter(f => f.properties && f.properties.ilce)
                        .map(f => f.properties.ilce)
                )].sort();
                setDistricts(uniqueDistricts);
            })
            .catch(console.error);

        fetchAssignments();
        fetchUsers();
    }, [token, user, navigate]);

    const fetchAssignments = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/regions/assignments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setAssignments(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchUsers = async () => {
        try {
            const endpoint = user?.role === 'admin' ? `${API_BASE_URL}/admin/users` : `${API_BASE_URL}/users`;
            const res = await fetch(`${endpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setUsers(data.data);
        } catch (err) { console.error(err); }
    };

    // Konya Map center
    const position = [37.8746, 32.4932];

    const getFeatureColor = (feature) => {
        const ilce = feature.properties.ilce;
        const mahalle = feature.properties.name;

        const assignment = assignments.find(a => a.ilce === ilce && a.mahalle === mahalle);
        if (assignment) {
            const assignedUser = users.find(u => u.id === assignment.userId);
            if (assignedUser) {
                return assignedUser.color || '#10b981'; // Fallback green
            }
        }
        return '#3b82f6'; // default blue
    };

    const styleFeature = (feature) => {
        return {
            fillColor: getFeatureColor(feature),
            fillOpacity: 0.6,
            color: '#ffffff',
            weight: 1
        };
    };

    const onEachMahalle = (feature, layer) => {
        if (feature.geometry.type === 'Point') {
            // Hide point markers from the geojson
            layer.options.opacity = 0;
            layer.options.fillOpacity = 0;
            return;
        }

        const ilce = feature.properties.ilce;
        const mahalle = feature.properties.name;

        // Find assignment for tooltip & click handler
        const assignment = assignments.find(a => a.ilce === ilce && a.mahalle === mahalle);
        let assignedUser = null;
        let baseColor = getFeatureColor(feature);

        if (assignment) {
            assignedUser = users.find(u => u.id === assignment.userId);
        }

        if (feature.properties && feature.properties.name) {
            const ilceName = ilce ? `(${ilce})` : '';
            const userText = assignedUser ? `<br/><span style="color:${baseColor};font-weight:bold;">👤 Atanan: ${assignedUser.displayName || assignedUser.username}</span>` : '';
            layer.bindTooltip(`<b>${mahalle}</b> <span style="color:#666;font-size:11px">${ilceName}</span>${userText}`, { sticky: true, className: 'custom-tooltip' });
        }

        // Hover & Click effects
        layer.on({
            mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                    fillColor: getFeatureColor(feature),
                    fillOpacity: 0.9, // Make it darker/more opaque on hover instead of orange to keep the user's color readable
                    color: '#ffffff',
                    weight: 2
                });
                l.bringToFront();
            },
            mouseout: (e) => {
                const l = e.target;
                l.setStyle({
                    fillColor: getFeatureColor(feature),
                    fillOpacity: 0.6,
                    color: '#ffffff',
                    weight: 1
                });
            },
            click: () => {
                if (user?.role === 'admin') {
                    setModalData({ ilce, mahalle, currentUserId: assignment ? assignment.userId : '' });
                }
            }
        });
    };

    const handleAssignSubmit = async (userId) => {
        if (!modalData) return;
        try {
            const res = await fetch(`${API_BASE_URL}/regions/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ilce: modalData.ilce,
                    mahalle: modalData.mahalle,
                    userId: userId
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchAssignments(); // Refresh map colors
                setModalData(null); // Close modal
                showToast('Bölge ataması başarıyla güncellendi.', 'success');
            } else {
                showAlert('Hata', data.error || 'Atama işlemi başarısız.');
            }
        } catch (err) {
            console.error(err);
            showAlert('Hata', 'Sunucu hatası.');
        }
    };

    // Filter out Point features to literally not render markers at all, and apply district filter
    const geoJsonFilter = (feature) => {
        const isPolygon = feature.geometry && feature.geometry.type !== 'Point';
        if (!isPolygon) return false;

        const ilce = feature.properties.ilce;
        const mahalle = feature.properties.name;

        // Apply "Only Mine" filter
        if (showOnlyMine) {
            const assignment = assignments.find(a => a.ilce === ilce && a.mahalle === mahalle);
            if (!assignment || assignment.userId !== user.id) {
                return false;
            }
        }

        if (selectedDistrict === 'Tümü') return true;
        return ilce === selectedDistrict;
    };

    return (
        <div className="font-sans animate-fade-in relative h-screen w-full overflow-hidden bg-slate-50">
            {/* Main Map Container */}
            <div className="absolute inset-0 z-0">
                <MapContainer 
                    center={position} 
                    zoom={9} 
                    zoomControl={false} // We will add it manually or just leave it out for cleaner look
                    style={{ height: '100%', width: '100%', background: '#f8fafc' }}
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {mahalleler && (
                        <GeoJSON
                            key={selectedDistrict + showOnlyMine + assignments.length + users.length + JSON.stringify(assignments)}
                            data={mahalleler}
                            style={styleFeature}
                            onEachFeature={onEachMahalle}
                            filter={geoJsonFilter}
                        />
                    )}
                </MapContainer>
            </div>

            {/* Top Floating Panel: Title & District Filter */}
            <div className="absolute top-6 left-6 right-6 z-[1000] flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl shadow-slate-200/50 rounded-2xl px-6 py-4 pointer-events-auto flex items-center gap-4 transition-all hover:bg-white/90">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">Bölgeler</h2>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Konya Bölge Dağılımı</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    {user?.role !== 'admin' && (
                        <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl shadow-slate-200/50 rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:bg-white/90">
                            <span className="text-sm font-semibold text-slate-700">Bölgelerim</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={showOnlyMine}
                                    onChange={(e) => setShowOnlyMine(e.target.checked)}
                                />
                                <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    )}
                    
                    <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl shadow-slate-200/50 rounded-2xl px-5 py-2.5 flex items-center gap-3 transition-all hover:bg-white/90">
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">İlçe:</span>
                        <select
                            className="bg-transparent border-none text-sm font-bold text-blue-600 outline-none cursor-pointer focus:ring-0 appearance-none pr-4"
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                        >
                            <option value="Tümü">Tüm Konya</option>
                            {districts.map((d, i) => (
                                <option key={i} value={d}>{d}</option>
                            ))}
                        </select>
                        <svg className="w-4 h-4 text-slate-400 -ml-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            {/* Bottom Panel: Legend */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-auto max-w-[90%] pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl px-6 py-4 pointer-events-auto flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap">
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                        <div className="w-3.5 h-3.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Atanmamış</span>
                    </div>
                    
                    <div className="h-4 w-[1px] bg-white/10 shrink-0"></div>

                    {/* De-duplicate users by displayName/username for the legend */}
                    {Array.from(new Set(users.filter(u => u.color).map(u => u.displayName || u.username))).map(name => {
                        const user = users.find(u => (u.displayName || u.username) === name);
                        return (
                            <div key={user.id} className="flex items-center gap-2.5 group shrink-0 transition-all hover:scale-105">
                                <div 
                                    className="w-4 h-4 rounded-full border-2 border-white/20 shadow-lg transition-transform" 
                                    style={{ backgroundColor: user.color }}
                                ></div>
                                <span className="text-xs font-bold text-white tracking-wide">{name}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Assignment Modal */}
            {modalData && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-fade-in">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">
                                Bölge Ataması
                            </h3>
                            <button onClick={() => setModalData(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-5 bg-gray-50">
                            <div className="mb-4">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">İlçe</span>
                                <div className="text-gray-900 font-medium">{modalData.ilce}</div>
                            </div>
                            <div className="mb-6">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Mahalle</span>
                                <div className="text-gray-900 font-medium">{modalData.mahalle}</div>
                            </div>

                            <label className="block text-sm font-medium text-gray-700 mb-2">Bu bölgeyi bir kullanıcıya ata:</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={modalData.currentUserId}
                                onChange={(e) => handleAssignSubmit(e.target.value)}
                            >
                                <option value="">-- Atamayı Kaldır --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName || u.username} ({u.role})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Regions;
