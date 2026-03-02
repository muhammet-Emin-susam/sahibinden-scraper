import React, { useState, useEffect, useContext, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function Regions() {
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
        fetch('/konya_mahalleler.geojson')
            .then(res => res.json())
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
            const res = await fetch('/api/regions/assignments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setAssignments(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchUsers = async () => {
        try {
            const endpoint = user?.role === 'admin' ? '/api/admin/users' : '/api/users';
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
            const res = await fetch('/api/regions/assign', {
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
            } else {
                alert("Hata: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Sunucu hatası.");
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
        <div className="font-sans animate-fade-in pb-10 flex flex-col h-screen">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                    Bölgeler Haritası (Konya)
                </h2>
                <div className="flex items-center gap-6">
                    {user?.role !== 'admin' && (
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200">
                            <span className="text-sm font-medium text-gray-700">Sadece Benim Bölgelerim</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={showOnlyMine}
                                    onChange={(e) => setShowOnlyMine(e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 w-auto whitespace-nowrap">İlçe Filtresi:</label>
                        <select
                            className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                        >
                            <option value="Tümü">Tüm Konya</option>
                            {districts.map((d, i) => (
                                <option key={i} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-[#f8fafc] rounded-xl shadow-lg border border-gray-200 overflow-hidden flex-1 relative z-0">
                <MapContainer center={position} zoom={8.4} style={{ height: '100%', width: '100%', background: '#f8fafc' }}>
                    {mahalleler && (
                        <GeoJSON
                            key={selectedDistrict + showOnlyMine + assignments.length + users.length + JSON.stringify(assignments)} // Force remount on data changes
                            data={mahalleler}
                            style={styleFeature}
                            onEachFeature={onEachMahalle}
                            filter={geoJsonFilter}
                        />
                    )}
                </MapContainer>
            </div>

            <div className="mt-4 flex gap-6 text-sm text-gray-600 justify-center flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-sm border border-gray-300 opacity-60"></div>
                    <span>Atanmamış Mahalle</span>
                </div>
                {users.filter(u => u.color).map(u => (
                    <div key={u.id} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm border border-gray-300 opacity-60" style={{ backgroundColor: u.color }}></div>
                        <span>{u.displayName || u.username}</span>
                    </div>
                ))}
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
