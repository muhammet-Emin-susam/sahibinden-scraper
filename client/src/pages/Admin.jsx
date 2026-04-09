import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';


function Admin() {
    const { token, user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [newColor, setNewColor] = useState('#f97316');

    const [adminNewUsername, setAdminNewUsername] = useState(user?.username || '');
    const [adminNewPassword, setAdminNewPassword] = useState('');
    const [adminCurrentPassword, setAdminCurrentPassword] = useState('');

    const [msg, setMsg] = useState({ type: '', text: '' });
    const [editingUser, setEditingUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null); // user to confirm delete

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/dashboard');
            return;
        }
        fetchUsers();
    }, [user, token]);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            const isEdit = !!editingUser;
            const url = isEdit
                ? `${API_BASE_URL}/admin/users/${editingUser.id}`
                : `${API_BASE_URL}/admin/users`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: newUsername,
                    password: newPassword || undefined,
                    displayName: newDisplayName,
                    color: newColor
                })
            });

            const data = await response.json();
            if (data.success) {
                setMsg({ type: 'success', text: isEdit ? 'Kullanıcı başarıyla güncellendi.' : 'Kullanıcı başarıyla oluşturuldu.' });
                if (!isEdit) {
                    setNewUsername('');
                    setNewPassword('');
                    setNewDisplayName('');
                    setNewColor('#f97316');
                } else {
                    setEditingUser(null);
                    setNewUsername('');
                    setNewPassword('');
                    setNewDisplayName('');
                    setNewColor('#f97316');
                }
                fetchUsers();
            } else {
                setMsg({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Sunucu hatası' });
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;
        try {
            const response = await fetch(`${API_BASE_URL}/admin/users/${deleteTarget.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setMsg({ type: 'success', text: `${deleteTarget.displayName || deleteTarget.username} hesabı silindi.` });
                setDeleteTarget(null);
                fetchUsers();
            } else {
                setMsg({ type: 'error', text: data.error });
                setDeleteTarget(null);
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Sunucu hatası' });
            setDeleteTarget(null);
        }
    };

    const handleReCategorize = async () => {
        setMsg({ type: 'info', text: 'Kategorilendirme başlatıldı...' });
        try {
            const response = await fetch(`${API_BASE_URL}/admin/re-categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });

            console.log("Re-categorize response status:", response.status);
            const data = await response.json();
            if (data.success) {
                setMsg({ type: 'success', text: data.message });
            } else {
                setMsg({ type: 'error', text: data.error });
            }
        } catch (err) {
            console.error("Re-categorize fetch error:", err);
            setMsg({ type: 'error', text: `Bağlantı hatası veya işlem zaman aşımı: ${err.message}` });
        }
    };

    const startEditing = (u) => {
        setEditingUser(u);
        setNewUsername(u.username);
        setNewDisplayName(u.displayName || '');
        setNewColor(u.color || '#f97316');
        setNewPassword('');
        setMsg({ type: '', text: '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingUser(null);
        setNewUsername('');
        setNewDisplayName('');
        setNewColor('#f97316');
        setNewPassword('');
    };

    const handleUpdateCredentials = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            const response = await fetch(`${API_BASE_URL}/admin/credentials`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    newUsername: adminNewUsername !== user.username ? adminNewUsername : undefined,
                    newPassword: adminNewPassword || undefined,
                    currentPassword: adminCurrentPassword
                })
            });

            const data = await response.json();
            if (data.success) {
                setMsg({ type: 'success', text: 'Giriş bilgileriniz güncellendi. Lütfen tekrar giriş yapın.' });
                setAdminCurrentPassword('');
                setAdminNewPassword('');
                setTimeout(() => {
                    logout();
                    navigate('/login');
                }, 2000);
            } else {
                setMsg({ type: 'error', text: data.error });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Sunucu hatası' });
        }
    };

    return (
        <>
            <div className="min-h-screen p-8 font-sans bg-gray-50">
                <div className="max-w-6xl mx-auto">
                    <header className="mb-10 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
                            <p className="text-gray-500 mt-1">Sistem ayarları ve kullanıcı yönetimi</p>
                        </div>
                        <div className="flex gap-4">
                            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex justify-center items-center">
                                Panoya Dön
                            </Link>
                        </div>
                    </header>

                    {msg.text && (
                        <div className={`mb-6 p-4 rounded-lg border ${msg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {msg.text}
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Admin Credentials */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path></svg>
                                Giriş Bilgilerimi Güncelle
                            </h2>
                            <form onSubmit={handleUpdateCredentials} className="space-y-4">
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Yeni Kullanıcı Adı (Opsiyonel)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        value={adminNewUsername}
                                        onChange={(e) => setAdminNewUsername(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Yeni Şifre (Opsiyonel)</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        value={adminNewPassword}
                                        onChange={(e) => setAdminNewPassword(e.target.value)}
                                        placeholder="Değiştirmek istemiyorsanız boş bırakın"
                                    />
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Mevcut Şifre (Gerekli)</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        value={adminCurrentPassword}
                                        onChange={(e) => setAdminCurrentPassword(e.target.value)}
                                        required
                                        placeholder="İşlemi onaylamak için mevcut şifreniz"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-colors"
                                >
                                    Bilgilerimi Güncelle
                                </button>
                            </form>

                            {/* Maintenance Actions */}
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    Sistem Bakımı
                                </h3>
                                <button
                                    onClick={handleReCategorize}
                                    className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-2.5 px-4 rounded-lg border border-purple-200 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                                    Tüm İlanları Kategorilendir
                                </button>
                                <p className="text-[10px] text-gray-400 mt-2">
                                    * Mevcut tüm ilanları başlık ve açıklamalarına göre otomatik olarak "Satılık/Kiralık" ve "Konut/Arsa/Ticari" şeklinde etiketler.
                                </p>
                            </div>
                        </div>

                        {/* Create User */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between border-b pb-3">
                                <span className="flex items-center gap-2">
                                    <svg className={`w-5 h-5 ${editingUser ? 'text-orange-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {editingUser ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                                        )}
                                    </svg>
                                    {editingUser ? 'Danışmanı Düzenle' : 'Yeni Danışman Oluştur'}
                                </span>
                                {editingUser && (
                                    <button onClick={cancelEditing} className="text-xs font-medium text-gray-500 hover:text-red-500 transition-colors">
                                        Vazgeç
                                    </button>
                                )}
                            </h2>
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Kullanıcı Adı</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Şifre {editingUser && '(Değiştirmek için yazın)'}</label>
                                    <input
                                        type="password"
                                        className={`w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:border-transparent outline-none ${editingUser ? 'focus:ring-orange-500' : 'focus:ring-green-500'}`}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required={!editingUser}
                                        placeholder={editingUser ? 'Şifreyi korumak için boş bırakın' : ''}
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Ad Soyad</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                        value={newDisplayName}
                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Harita Rengi</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            className="h-10 w-14 rounded cursor-pointer"
                                            value={newColor}
                                            onChange={(e) => setNewColor(e.target.value)}
                                            required
                                        />
                                        <span className="text-sm text-gray-500 font-mono">{newColor}</span>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-colors mt-2 ${editingUser ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                                >
                                    {editingUser ? 'Değişiklikleri Kaydet' : 'Danışman Ekle'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                Sistem Kullanıcıları
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                                        <th className="p-4 border-y border-gray-200">Kullanıcı Adı</th>
                                        <th className="p-4 border-y border-gray-200">Ad Soyad</th>
                                        <th className="p-4 border-y border-gray-200">Renk</th>
                                        <th className="p-4 border-y border-gray-200">Rol</th>
                                        <th className="p-4 border-y border-gray-200">Kayıt Tarihi</th>
                                        <th className="p-4 border-y border-gray-200 text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-medium text-gray-900">{u.username}</td>
                                            <td className="p-4 text-gray-600">{u.displayName || '-'}</td>
                                            <td className="p-4">
                                                {u.color ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-md shadow-sm border border-gray-200" style={{ backgroundColor: u.color }}></div>
                                                        <span className="text-xs text-gray-500 font-mono">{u.color}</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {u.role === 'admin' ? 'Yönetici' : 'Danışman'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-500 text-sm">
                                                {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => startEditing(u)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Düzenle"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                    </button>
                                                    {u.role !== 'admin' && (
                                                        <button
                                                            onClick={() => setDeleteTarget(u)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Hesabı Sil"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-500">Henüz kullanıcı yok</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {
                deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 fade-in duration-200">
                            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
                                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Hesabı Sil</h3>
                            <p className="text-center text-gray-600 mb-1">
                                <span className="font-bold text-gray-900">{deleteTarget.displayName || deleteTarget.username}</span> adlı danışmanın hesabı silinecek.
                            </p>
                            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
                                <p className="font-black">⚠️ Bu işlem geri alınamaz!</p>
                                <p>Hesap silindikten sonra danışmana ait tüm veriler <span className="font-bold">kalıcı olarak kaybolacaktır</span>. Silmeden önce gerekli yedekleri aldığınızdan emin olun.</p>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black transition-colors"
                                >
                                    Evet, Sil
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
}

export default Admin;
