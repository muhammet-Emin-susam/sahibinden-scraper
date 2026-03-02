import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const DnDCalendar = withDragAndDrop(Calendar);

const locales = {
    'tr': tr,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

function Appointments() {
    const [appointments, setAppointments] = useState([]);
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token, user } = useContext(AuthContext);
    const navigate = useNavigate();

    // View State
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
    const [calendarView, setCalendarView] = useState('month');
    const [calendarDate, setCalendarDate] = useState(new Date());

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showListingPicker, setShowListingPicker] = useState(false);
    const [listingSearch, setListingSearch] = useState('');
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        quotedListing: null,
        appointmentDate: '',
        status: 'Yeni',
        note: ''
    });

    const statusOptions = ['Yeni', 'İletişim Kuruldu', 'Randevu Alındı', 'Olumsuz', 'İşlem Tamamlandı'];

    // Status colors mapping
    const statusColors = {
        'Yeni': 'bg-blue-100 text-blue-700 border-blue-200',
        'İletişim Kuruldu': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'Randevu Alındı': 'bg-purple-100 text-purple-700 border-purple-200',
        'Olumsuz': 'bg-red-100 text-red-700 border-red-200',
        'İşlem Tamamlandı': 'bg-green-100 text-green-700 border-green-200',
    };

    const fetchAppointmentsAndListings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [appRes, listRes] = await Promise.all([
                fetch('/api/appointments', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/records', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const appResult = await appRes.json();
            const listResult = await listRes.json();

            if (appResult.success) setAppointments(appResult.data);
            if (listResult.success) {
                // Sadece onaylı ilanlardan seçim yaptırmak daha mantıklı olabilir
                setListings(listResult.data.filter(l => l.status === 'approved'));
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') {
            navigate('/home');
            return;
        }
        fetchAppointmentsAndListings();
    }, [token]);

    const handleOpenModal = (appointment = null) => {
        if (appointment) {
            setEditingId(appointment.id);
            setFormData({
                customerName: appointment.customerName || '',
                customerPhone: appointment.customerPhone || '',
                quotedListing: appointment.quotedListing || null,
                appointmentDate: appointment.appointmentDate || '',
                status: appointment.status || 'Yeni',
                note: appointment.note || ''
            });
        } else {
            setEditingId(null);
            setFormData({
                customerName: '',
                customerPhone: '',
                quotedListing: null,
                appointmentDate: '',
                status: 'Yeni',
                note: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
        setShowListingPicker(false);
        setListingSearch('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = editingId
            ? `/api/appointments/${editingId}`
            : '/api/appointments';

        const method = editingId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (result.success) {
                fetchAppointmentsAndListings();
                handleCloseModal();
            } else {
                alert("Hata: " + result.error);
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("Kaydedilemedi!");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu randevu/iletişim kaydını silmek istediğinize emin misiniz?")) return;

        try {
            const response = await fetch(`/api/appointments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                setAppointments(prev => prev.filter(app => app.id !== id));
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("Silinemedi!");
        }
    };

    const handleEventDrop = async ({ event, start, end }) => {
        const appointmentId = event.id;
        try {
            const response = await fetch(`/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    appointmentDate: start.toISOString()
                })
            });
            const result = await response.json();
            if (result.success) {
                setAppointments(prev => prev.map(app =>
                    app.id === appointmentId ? { ...app, appointmentDate: start.toISOString() } : app
                ));
            }
        } catch (err) {
            console.error("Failed to update appointment date", err);
        }
    };

    const handleSelectSlot = (slotInfo) => {
        // Prepare local timezone accurate date formatting for the form input
        const d = slotInfo.start;
        // The input format requires YYYY-MM-DDTHH:mm
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, 16);

        setEditingId(null);
        setFormData({
            customerName: '',
            customerPhone: '',
            quotedListing: null,
            appointmentDate: localISOTime,
            status: 'Yeni',
            note: ''
        });
        setShowModal(true);
    };

    return (
        <div className="animate-fade-in-up pb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 flex items-center gap-3">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        Randevular & Görüşmeler
                    </h2>
                    <p className="text-gray-500 font-medium">
                        Müşteri görüşmelerini, takibini ve ilan notlarını buradan yönetebilirsiniz.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Takvim
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                            Kartlar
                        </button>
                    </div>

                    <button
                        onClick={fetchAppointmentsAndListings}
                        className="bg-white hover:bg-gray-50 text-gray-600 font-semibold py-2.5 px-4 rounded-xl shadow-sm border border-gray-200 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Yenile
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-md shadow-indigo-200 transition-colors flex items-center gap-2 scale-100 hover:scale-[1.02] active:scale-95 duration-200"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        Yeni Görüşme
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : appointments.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
                    <div className="text-indigo-200 mb-6 inline-block bg-indigo-50 p-6 rounded-full">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Henüz Kayıt Yok</h3>
                    <p className="text-gray-500 max-w-md mx-auto">Müşteri görüşmelerinizi veya randevularınızı ekleyerek buradan kolayca takip etmeye başlayın.</p>
                </div>
            ) : (
                viewMode === 'calendar' ? (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[700px]">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            /* Modernizing React Big Calendar */
                            .rbc-calendar { font-family: inherit; }
                            
                            /* Toolbar */
                            .rbc-toolbar { margin-bottom: 24px; padding: 0 8px; }
                            .rbc-btn-group { display: flex; gap: 4px; }
                            .rbc-btn-group button { 
                                border: 1px solid #e5e7eb; 
                                color: #4b5563; 
                                border-radius: 10px !important; 
                                padding: 8px 16px;
                                font-weight: 600;
                                transition: all 0.2s ease;
                                background: white;
                            }
                            .rbc-btn-group button.rbc-active { 
                                background-color: #4f46e5; 
                                color: white; 
                                border-color: #4f46e5; 
                                box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); 
                            }
                            .rbc-btn-group button:hover:not(.rbc-active) { 
                                background-color: #f9fafb; 
                                border-color: #d1d5db;
                            }
                            .rbc-toolbar button:active, .rbc-toolbar button.rbc-active:active { box-shadow: none; }
                            .rbc-toolbar-label { font-weight: 800; color: #111827; font-size: 1.25rem; }
                            
                            /* Headers */
                            .rbc-header { 
                                padding: 12px 8px; 
                                font-weight: 700; 
                                color: #6b7280; 
                                text-transform: uppercase; 
                                font-size: 0.75rem; 
                                border-color: #f3f4f6; 
                                min-height: 40px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }
                            
                            /* Grid and Cells */
                            .rbc-month-view, .rbc-time-view, .rbc-agenda-view { 
                                border: 1px solid #f3f4f6; 
                                border-radius: 16px; 
                                overflow: hidden;
                                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
                            }
                            .rbc-month-row, .rbc-day-bg, .rbc-day-slot { border-color: #f3f4f6; }
                            .rbc-day-bg.rbc-today { background-color: #fefce8; }
                            .rbc-off-range-bg { background-color: #fafaf9; }
                            .rbc-date-cell { padding: 8px; font-size: 0.875rem; color: #374151; font-weight: 600; }
                            
                            /* Events */
                            .rbc-event { 
                                border-radius: 8px; 
                                padding: 4px 8px; 
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
                                font-weight: 600;
                                font-size: 0.8rem;
                                border: 1px solid rgba(0,0,0,0.05) !important;
                                transition: transform 0.1s ease;
                            }
                            .rbc-event:hover {
                                transform: scale(1.02);
                                opacity: 0.95;
                                z-index: 10;
                            }
                            .rbc-show-more { 
                                color: #4f46e5; 
                                font-weight: 700; 
                                font-size: 0.75rem; 
                                padding: 2px 8px;
                                border-radius: 4px;
                                background: #eef2ff;
                                display: inline-block;
                                margin-left: 4px;
                            }
                            .rbc-addons-dnd .rbc-addons-dnd-resizable { padding: 4px; }
                            
                            /* Time View Adjustments */
                            .rbc-time-header.rbc-overflowing { border-right: none; }
                            .rbc-time-content { border-top: 1px solid #f3f4f6; }
                            .rbc-timeslot-group { border-color: #f3f4f6; }
                        `}} />
                        <DnDCalendar
                            localizer={localizer}
                            view={calendarView}
                            onView={setCalendarView}
                            date={calendarDate}
                            onNavigate={setCalendarDate}
                            events={appointments.filter(app => app.appointmentDate).map(app => ({
                                id: app.id,
                                title: `${app.customerName || 'İsimsiz'} - ${app.status}`,
                                start: new Date(app.appointmentDate),
                                end: new Date(new Date(app.appointmentDate).getTime() + 60 * 60 * 1000), // Assuming 1 hour slot
                                resource: app
                            }))}
                            startAccessor="start"
                            endAccessor="end"
                            culture="tr"
                            messages={{
                                next: "İleri",
                                previous: "Geri",
                                today: "Bugün",
                                month: "Ay",
                                week: "Hafta",
                                day: "Gün",
                                agenda: "Ajanda",
                                date: "Tarih",
                                time: "Saat",
                                event: "Randevu",
                                noEventsInRange: "Bu aralıkta randevu bulunmuyor."
                            }}
                            onSelectEvent={(event) => handleOpenModal(event.resource)}
                            onEventDrop={handleEventDrop}
                            selectable
                            onSelectSlot={handleSelectSlot}
                            resizable={false} // Only allow dropping for simplicity, duration isn't strictly defined by the user right now
                            eventPropGetter={(event) => {
                                // Dynamic coloring based on status similar to cards
                                let bgColor = '#6366f1'; // Default Indigo
                                const status = event.resource.status;
                                if (status === 'İletişim Kuruldu') bgColor = '#eab308'; // Yellow
                                if (status === 'Randevu Alındı') bgColor = '#a855f7'; // Purple
                                if (status === 'Olumsuz') bgColor = '#ef4444'; // Red
                                if (status === 'İşlem Tamamlandı') bgColor = '#22c55e'; // Green

                                return {
                                    style: {
                                        backgroundColor: bgColor,
                                        border: 'none',
                                    }
                                };
                            }}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {appointments.map(app => (
                            <div key={app.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow relative group">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => handleOpenModal(app)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </button>
                                    <button onClick={() => handleDelete(app.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 mb-4 pr-16">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0 border border-indigo-200">
                                        {app.customerName ? app.customerName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg truncate" title={app.customerName}>{app.customerName || 'İsimsiz Müşteri'}</h3>
                                        {user?.role === 'admin' && (
                                            <p className="text-xs text-gray-500">Danışman: <span className="font-semibold">{app.displayName}</span></p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm">
                                    {app.customerPhone && (
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            <a href={`tel:${app.customerPhone}`} className="hover:text-indigo-600 hover:underline">{app.customerPhone}</a>
                                        </div>
                                    )}

                                    {app.appointmentDate && (
                                        <div className="flex items-center gap-2 text-indigo-700 font-medium bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            Randevu: <span className="text-gray-800">{new Date(app.appointmentDate).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}</span>
                                        </div>
                                    )}

                                    {app.quotedListing && (
                                        <div className="flex items-start gap-3 bg-indigo-50/50 hover:bg-indigo-50 p-3 rounded-xl border border-indigo-100 transition-colors mt-2">
                                            {(app.quotedListing.imageUrl || app.quotedListing.image) && (
                                                <img
                                                    src={app.quotedListing.imageUrl || app.quotedListing.image}
                                                    alt=""
                                                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white shadow-sm"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <a href={app.quotedListing.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-900 hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">
                                                    {app.quotedListing.title}
                                                </a>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-bold text-indigo-600">{app.quotedListing.price}</span>
                                                    <span className="text-xs text-gray-400">· {app.quotedListing.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColors[app.status] || 'bg-gray-100 text-gray-700'}`}>
                                                {app.status}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                Eklenme: {new Date(app.createdAt).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        {app.note ? (
                                            <p className="text-gray-600 text-xs line-clamp-3 bg-yellow-50/50 p-2 rounded-lg border border-yellow-100/50 italic">
                                                "{app.note}"
                                            </p>
                                        ) : (
                                            <p className="text-gray-400 text-xs italic">Not eklenmemiş.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-center bg-gray-50 px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingId ? 'Görüşmeyi Düzenle' : 'Yeni Görüşme & Randevu Ekle'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        İlan Seçimi (Opsiyonel)
                                    </label>
                                    {formData.quotedListing ? (
                                        <div className="border border-indigo-100 bg-indigo-50 flex-col rounded-xl p-3 flex gap-3 shadow-sm">
                                            <div className="flex justify-between items-start gap-3 w-full">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-indigo-700 truncate">{formData.quotedListing.title}</p>
                                                    <p className="text-xs text-indigo-500 font-semibold mt-0.5">{formData.quotedListing.price}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, quotedListing: null })}
                                                    className="text-indigo-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                    title="Alıntıyı Kaldır"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowListingPicker(true)}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-gray-500 font-medium text-sm focus:outline-none"
                                        >
                                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            Kayıtlı İlan Seç
                                        </button>
                                    )}
                                    <p className="text-[10px] text-gray-400 mt-1.5 ml-1">İlan seçildiğinde satıcı adı ve telefon numarası forma otomatik olarak doldurulur.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Müşteri Adı / Soyadı</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.customerName}
                                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                            className="w-full border-gray-300 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border outline-none"
                                            placeholder="Örn: Ahmet Yılmaz"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Telefon Numarası</label>
                                        <input
                                            type="text"
                                            value={formData.customerPhone}
                                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                            className="w-full border-gray-300 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border outline-none"
                                            placeholder="0555 444 33 22"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Randevu Tarihi</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.appointmentDate}
                                            onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                                            className="w-full border-gray-300 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border outline-none bg-gray-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Durum</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full border-gray-300 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border outline-none bg-gray-50 cursor-pointer"
                                        >
                                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Görüşme Notu</label>
                                    <textarea
                                        rows="3"
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        className="w-full border-gray-300 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border outline-none resize-none"
                                        placeholder="Müşteri şunları talep etti, 3 gün sonra dönüş yapılacak..."
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Listing Picker Modal */}
            {showListingPicker && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowListingPicker(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-gray-900">İlan Seç</h3>
                            <button onClick={() => setShowListingPicker(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="İlan başlığı ara..."
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm bg-white"
                                    value={listingSearch}
                                    onChange={e => setListingSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-3">
                            {listings
                                .filter(l => !listingSearch || (l.title || '').toLowerCase().includes(listingSearch.toLowerCase()))
                                .slice(0, 30)
                                .map(l => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        className="w-full flex gap-3 items-center p-3 rounded-xl hover:bg-indigo-50 transition-colors text-left group border border-transparent hover:border-indigo-100"
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                quotedListing: {
                                                    id: l.id,
                                                    title: l.title,
                                                    price: l.price,
                                                    location: l.location || '',
                                                    neighborhood: l.neighborhood || '',
                                                    imageUrl: l.imageUrl || l.image || '',
                                                    url: l.url || ''
                                                },
                                                customerPhone: l.phone || l.sellerPhone || l.storePhone || l.mobilePhone || prev.customerPhone,
                                                customerName: l.sellerName || l.storeName || l.name || prev.customerName
                                            }));
                                            setShowListingPicker(false);
                                            setListingSearch('');
                                        }}
                                    >
                                        {(l.imageUrl || l.image) && (
                                            <img src={l.imageUrl || l.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white shadow-sm" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{l.title}</p>
                                            <p className="text-xs text-indigo-600 font-bold mt-0.5">{l.price}</p>
                                            {(l.location || l.neighborhood) && <p className="text-[10px] text-gray-400 truncate mt-0.5 uppercase tracking-wider">{l.location || l.neighborhood}</p>}
                                        </div>
                                    </button>
                                ))
                            }
                            {listings.length === 0 && (
                                <div className="text-center py-10">
                                    <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    <p className="text-gray-500 font-medium">Kayıtlı onaylı ilanınız bulunamadı.</p>
                                    <p className="text-xs text-gray-400 mt-1">Sadece onaylanan ilanlar listelenir.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Appointments;
