import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const CITIES = [
    { name: 'Adana', lat: 37.0000, lon: 35.3213 },
    { name: 'Ankara', lat: 39.9334, lon: 32.8597 },
    { name: 'Antalya', lat: 36.8969, lon: 30.7133 },
    { name: 'Bursa', lat: 40.1828, lon: 29.0667 },
    { name: 'Diyarbakır', lat: 37.9144, lon: 40.2306 },
    { name: 'Erzurum', lat: 39.9000, lon: 41.2700 },
    { name: 'Eskişehir', lat: 39.7767, lon: 30.5206 },
    { name: 'Gaziantep', lat: 37.0662, lon: 37.3833 },
    { name: 'İstanbul', lat: 41.0138, lon: 28.9497 },
    { name: 'İzmir', lat: 38.4127, lon: 27.1384 },
    { name: 'Kayseri', lat: 38.7312, lon: 35.4787 },
    { name: 'Konya', lat: 37.8667, lon: 32.4833 },
    { name: 'Mersin', lat: 36.8000, lon: 34.6333 },
    { name: 'Samsun', lat: 41.2867, lon: 36.3300 },
    { name: 'Trabzon', lat: 41.0050, lon: 39.7269 }
];

function Settings() {
    const { user } = useContext(AuthContext);
    const [selectedCity, setSelectedCity] = useState('İstanbul');

    useEffect(() => {
        const savedCity = localStorage.getItem('efdal_weather_city');
        if (savedCity) {
            setSelectedCity(savedCity);
        }
    }, []);

    const handleCityChange = (e) => {
        const newCity = e.target.value;
        setSelectedCity(newCity);
        localStorage.setItem('efdal_weather_city', newCity);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-10">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Ayarlar</h1>
                </div>
                <p className="text-gray-500 ml-16 font-medium">Hesap bilgilerinizi ve uygulama tercihlerinizi yönetin.</p>
            </header>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-4xl">
                <div className="flex items-start gap-8 flex-col md:flex-row">
                    <div className="w-full md:w-64 flex-shrink-0">
                        <div className="w-32 h-32 rounded-full bg-indigo-50 border-4 border-white shadow-lg mx-auto md:mx-0 flex items-center justify-center text-4xl font-black text-indigo-400">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="mt-6 text-center md:text-left">
                            <h3 className="text-lg font-bold text-gray-900">{user?.displayName || 'Kullanıcı'}</h3>
                            <p className="text-indigo-600 font-medium text-sm">{user?.role === 'admin' ? 'Yönetici' : 'Danışman'}</p>
                        </div>
                    </div>

                    <div className="flex-1 w-full p-4 md:p-0">
                        <h4 className="text-md font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Kişisel Bilgiler</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Kullanıcı Adı</label>
                                <input type="text" readOnly value={user?.username || ''} className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 font-medium focus:outline-none" />
                                <p className="text-xs text-gray-400 mt-1">Giriş yapmak için kullandığınız belirteç.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Görünür İsim</label>
                                <input type="text" readOnly value={user?.displayName || ''} className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 font-medium focus:outline-none" />
                            </div>
                        </div>

                        <h4 className="text-md font-bold text-gray-900 mt-8 mb-4 border-b border-gray-100 pb-2">Görünüm ve Bileşenler</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Hava Durumu Konumu</label>
                                <select
                                    value={selectedCity}
                                    onChange={handleCityChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow appearance-none cursor-pointer"
                                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234B5563%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                                >
                                    {CITIES.map(city => (
                                        <option key={city.name} value={city.name}>{city.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1.5">Anasayfa panelindeki hava durumu bildirimleri için gösterilecek olan şehri seçin.</p>
                            </div>
                        </div>

                        <div className="mt-8 bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-4">
                            <div className="text-amber-500 mt-1 flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-amber-800 mb-1">Hesap ayarlarınızı güncellemek ister misiniz?</h4>
                                <p className="text-xs text-amber-700 font-medium">Profil bilgilerinizi veya şifrenizi değiştirmek için lütfen sistem yöneticinizle (Admin) iletişime geçin.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
